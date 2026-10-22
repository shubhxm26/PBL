#!/usr/bin/env python3
"""
Standalone Model Training Script for Cognitive Smart Logistics Platform.
Generates, trains, and saves lightweight, CPU-optimized PyTorch .pt model checkpoints for:
  1. Demand Forecasting Engine (Multi-Horizon LSTM with 95% Confidence Bounds)
  2. Fleet Route Optimizer Engine (DRL Attention Policy Network for VRP)

Usage:
  python train_models.py
  python train_models.py --epochs 30 --lr 0.005 --models all
  python train_models.py --models forecasting --epochs 40
  python train_models.py --models routing --epochs 25
"""

import os
import sys
import math
import time
import argparse
import logging
from typing import Dict, Any, Tuple, Optional

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from app.engines.forecasting_engine import (
    PyTorchDemandForecaster,
    CHECKPOINT_DIR as FORECASTING_CHECKPOINT_DIR,
    MODEL_PATH as FORECASTING_MODEL_PATH
)
from app.engines.routing_engine import (
    DRLRoutePolicyNetwork,
    CHECKPOINT_DIR as ROUTING_CHECKPOINT_DIR,
    MODEL_PATH as ROUTING_MODEL_PATH
)
from app.db.seed_data import FALLBACK_HISTORICAL_SALES, FALLBACK_SKUS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("train_models")


# ============================================================================
# 1. Forecasting Model Training (PyTorch Multi-Horizon LSTM)
# ============================================================================

def generate_forecasting_training_data(
    seq_len: int = 30,
    max_horizon: int = 30,
    num_samples: int = 256,
    seed: int = 42
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Synthesize realistic sequential demand sequences grounded in Western India
    corridor daily sales, incorporating weekly seasonality, promo events, and monsoon weather.
    
    Returns:
        inputs:  [num_samples, seq_len, 5]
        targets: [num_samples, max_horizon]
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    inputs = []
    targets = []

    # Extract base sales levels from seed data
    sku_bases = [s.get("base_daily_demand", 150) for s in FALLBACK_SKUS]
    if not sku_bases:
        sku_bases = [120, 250, 80, 400]

    for i in range(num_samples):
        base_demand = float(np.random.choice(sku_bases))
        total_days = seq_len + max_horizon
        
        # Timeline generation with seasonality
        t = np.arange(total_days)
        # Weekly cycle (7-day periodic wave)
        weekly_factor = 1.0 + 0.25 * np.sin(2 * np.pi * t / 7.0)
        # Random promotional shocks (5% chance of promo)
        promo_mask = (np.random.rand(total_days) < 0.15).astype(float)
        promo_uplift = promo_mask * np.random.uniform(0.15, 0.35, size=total_days)
        # Monsoon / weather disruption shocks
        weather_shock = (np.random.rand(total_days) < 0.10).astype(float) * np.random.uniform(-0.25, -0.05, size=total_days)
        
        # Noise
        noise = np.random.normal(0, 0.08, size=total_days)
        
        # Combined demand sequence
        demand_seq = base_demand * (weekly_factor + promo_uplift + weather_shock + noise)
        demand_seq = np.clip(demand_seq, 10.0, None)

        # Normalize features
        mean_demand = float(np.mean(demand_seq[:seq_len]))
        norm_sales = demand_seq / max(1.0, mean_demand)
        
        # Feature matrix: [sales, sin_dow, cos_dow, promo, weather]
        sin_dow = np.sin(2 * np.pi * (t % 7) / 7.0)
        cos_dow = np.cos(2 * np.pi * (t % 7) / 7.0)
        weather_feat = np.clip(np.abs(weather_shock) * 3.0, 0.0, 1.0)
        
        sample_features = np.stack([
            norm_sales[:seq_len],
            sin_dow[:seq_len],
            cos_dow[:seq_len],
            promo_mask[:seq_len],
            weather_feat[:seq_len]
        ], axis=-1)  # [seq_len, 5]

        # Target: normalized multi-horizon future sequence
        target_seq = norm_sales[seq_len:seq_len + max_horizon]

        inputs.append(sample_features)
        targets.append(target_seq)

    inputs_tensor = torch.tensor(np.array(inputs), dtype=torch.float32)
    targets_tensor = torch.tensor(np.array(targets), dtype=torch.float32)
    return inputs_tensor, targets_tensor


def train_forecasting_model(
    epochs: int = 25,
    lr: float = 0.005,
    save_path: Optional[str] = None,
    quiet: bool = False
) -> Dict[str, Any]:
    """
    Train and calibrate the PyTorch LSTM demand forecasting neural network.
    Saves the weights to the checkpoint directory.
    """
    checkpoint_file = save_path or FORECASTING_MODEL_PATH
    os.makedirs(os.path.dirname(os.path.abspath(checkpoint_file)), exist_ok=True)

    if not quiet:
        logger.info("--> Starting PyTorch Demand Forecaster Training (LSTM)...")

    device = torch.device("cpu")
    model = PyTorchDemandForecaster(input_dim=5, hidden_dim=48, max_horizon=30).to(device)
    model.train()

    inputs, targets = generate_forecasting_training_data(seq_len=30, max_horizon=30, num_samples=320)
    dataset_size = inputs.size(0)
    batch_size = 32
    num_batches = math.ceil(dataset_size / batch_size)

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    mse_criterion = nn.MSELoss()

    loss_history = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        perm = torch.randperm(dataset_size)
        epoch_loss = 0.0

        for b in range(num_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            batch_x = inputs[idx].to(device)
            batch_y = targets[idx].to(device)

            optimizer.zero_grad()
            pred_points, pred_stds = model(batch_x)
            
            # Joint Point Loss (MSE) + Uncertainty Calibration Penalty
            loss_point = mse_criterion(pred_points, batch_y)
            # Empirical variance constraint: std should scale with absolute residuals
            abs_residuals = torch.abs(pred_points.detach() - batch_y)
            loss_uncertainty = mse_criterion(pred_stds, abs_residuals)
            
            total_loss = loss_point + 0.35 * loss_uncertainty
            total_loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            epoch_loss += total_loss.item()

        scheduler.step()
        avg_loss = epoch_loss / num_batches
        loss_history.append(round(avg_loss, 5))

        if not quiet and (epoch == 1 or epoch % 5 == 0 or epoch == epochs):
            logger.info("  [Forecaster] Epoch %2d/%2d - Loss: %.5f", epoch, epochs, avg_loss)

    elapsed_time = round(time.time() - start_time, 2)
    model.eval()

    # Validation evaluation
    with torch.no_grad():
        val_x, val_y = generate_forecasting_training_data(seq_len=30, max_horizon=30, num_samples=64, seed=99)
        val_points, val_stds = model(val_x)
        val_mae = float(torch.mean(torch.abs(val_points - val_y)).item())
        val_rmse = float(torch.sqrt(torch.mean((val_points - val_y) ** 2)).item())

    # Save model checkpoint
    torch.save(model.state_dict(), checkpoint_file)
    file_size_kb = round(os.path.getsize(checkpoint_file) / 1024, 1)

    if not quiet:
        logger.info(
            "--> Forecasting Model saved to %s (%s KB) | Val MAE: %.4f | Val RMSE: %.4f in %ss",
            checkpoint_file, file_size_kb, val_mae, val_rmse, elapsed_time
        )

    return {
        "model": "forecasting_lstm",
        "epochs": epochs,
        "final_train_loss": loss_history[-1],
        "val_mae": round(val_mae, 4),
        "val_rmse": round(val_rmse, 4),
        "elapsed_seconds": elapsed_time,
        "checkpoint_path": checkpoint_file,
        "file_size_kb": file_size_kb,
        "status": "trained_and_saved"
    }


# ============================================================================
# 2. Routing Model Training (PyTorch DRL Route Policy Network)
# ============================================================================

def generate_routing_training_scenarios(
    num_scenarios: int = 128,
    num_nodes: int = 6,
    seed: int = 42
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Generate synthetic corridor delivery graph problem instances across Mumbai, JNPT,
    Thane, Nashik, and Pune.
    
    Returns:
        node_features:    [num_scenarios, num_nodes, 5]
        context_features: [num_scenarios, 5]
        target_actions:   [num_scenarios] (greedy optimal next-step target)
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    # Reference corridor bounding box: Lat 18.5 - 20.0, Lon 72.8 - 74.0
    nodes_list = []
    contexts_list = []
    targets_list = []

    for _ in range(num_scenarios):
        # Generate depot (node 0) and customer delivery stops (nodes 1..num_nodes-1)
        lats = np.random.uniform(18.5, 20.0, size=num_nodes)
        lons = np.random.uniform(72.8, 74.0, size=num_nodes)
        # Demands: depot = 0.0, customers = 0.1 to 0.4 of vehicle capacity
        demands = np.zeros(num_nodes)
        demands[1:] = np.random.uniform(0.1, 0.35, size=num_nodes - 1)
        service_times = np.random.uniform(0.2, 0.8, size=num_nodes)
        tw_ends = np.random.uniform(4.0, 10.0, size=num_nodes)

        nodes = np.stack([lats, lons, demands, service_times, tw_ends], axis=-1)  # [N, 5]

        # Vehicle context: current lat, current lon, remaining cap, current time, traffic index
        cur_lat = float(lats[0])
        cur_lon = float(lons[0])
        rem_cap = 1.0
        cur_time = 0.0
        traffic_idx = float(np.random.uniform(1.0, 1.6))
        ctx = np.array([cur_lat, cur_lon, rem_cap, cur_time, traffic_idx], dtype=np.float32)

        # Target action: Nearest unvisited customer with feasible capacity
        dists = np.hypot(lats[1:] - cur_lat, lons[1:] - cur_lon)
        best_next_node = int(np.argmin(dists) + 1)

        nodes_list.append(nodes)
        contexts_list.append(ctx)
        targets_list.append(best_next_node)

    return (
        torch.tensor(np.array(nodes_list), dtype=torch.float32),
        torch.tensor(np.array(contexts_list), dtype=torch.float32),
        torch.tensor(np.array(targets_list), dtype=torch.long)
    )


def train_routing_model(
    epochs: int = 25,
    lr: float = 0.005,
    save_path: Optional[str] = None,
    quiet: bool = False
) -> Dict[str, Any]:
    """
    Train and calibrate the PyTorch DRL route policy neural network.
    Saves the weights to the checkpoint directory.
    """
    checkpoint_file = save_path or ROUTING_MODEL_PATH
    os.makedirs(os.path.dirname(os.path.abspath(checkpoint_file)), exist_ok=True)

    if not quiet:
        logger.info("--> Starting PyTorch Routing Policy Training (DRL Network)...")

    device = torch.device("cpu")
    model = DRLRoutePolicyNetwork(node_dim=5, context_dim=5, hidden_dim=64).to(device)
    model.train()

    nodes, contexts, targets = generate_routing_training_scenarios(num_scenarios=256, num_nodes=6)
    dataset_size = nodes.size(0)
    batch_size = 32
    num_batches = math.ceil(dataset_size / batch_size)

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    ce_criterion = nn.CrossEntropyLoss()

    loss_history = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        perm = torch.randperm(dataset_size)
        epoch_loss = 0.0

        for b in range(num_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            batch_nodes = nodes[idx].to(device)
            batch_ctx = contexts[idx].to(device)
            batch_y = targets[idx].to(device)

            # Mask depot (index 0) from being chosen as immediate next stop
            batch_mask = torch.zeros(batch_nodes.size(0), batch_nodes.size(1), dtype=torch.bool, device=device)
            batch_mask[:, 0] = True

            optimizer.zero_grad()
            scores = model(batch_nodes, batch_ctx, mask=batch_mask)
            loss = ce_criterion(scores, batch_y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            epoch_loss += loss.item()

        scheduler.step()
        avg_loss = epoch_loss / num_batches
        loss_history.append(round(avg_loss, 5))

        if not quiet and (epoch == 1 or epoch % 5 == 0 or epoch == epochs):
            logger.info("  [Routing DRL] Epoch %2d/%2d - Loss: %.5f", epoch, epochs, avg_loss)

    elapsed_time = round(time.time() - start_time, 2)
    model.eval()

    # Validation accuracy
    with torch.no_grad():
        val_nodes, val_ctx, val_targets = generate_routing_training_scenarios(num_scenarios=64, num_nodes=6, seed=88)
        val_mask = torch.zeros(val_nodes.size(0), val_nodes.size(1), dtype=torch.bool, device=device)
        val_mask[:, 0] = True
        val_scores = model(val_nodes, val_ctx, mask=val_mask)
        val_preds = torch.argmax(val_scores, dim=-1)
        val_acc = float(torch.mean((val_preds == val_targets).float()).item()) * 100.0

    # Save model checkpoint
    torch.save(model.state_dict(), checkpoint_file)
    file_size_kb = round(os.path.getsize(checkpoint_file) / 1024, 1)

    if not quiet:
        logger.info(
            "--> Routing DRL Model saved to %s (%s KB) | Top-1 Accuracy: %.1f%% in %ss",
            checkpoint_file, file_size_kb, val_acc, elapsed_time
        )

    return {
        "model": "routing_drl",
        "epochs": epochs,
        "final_train_loss": loss_history[-1],
        "top1_accuracy_pct": round(val_acc, 1),
        "elapsed_seconds": elapsed_time,
        "checkpoint_path": checkpoint_file,
        "file_size_kb": file_size_kb,
        "status": "trained_and_saved"
    }


# ============================================================================
# 3. Unified Orchestration & CLI
# ============================================================================

def train_all_models(
    epochs: int = 25,
    lr: float = 0.005,
    checkpoint_dir: Optional[str] = None,
    quiet: bool = False
) -> Dict[str, Any]:
    """
    Train both forecasting and routing PyTorch models and save to checkpoint directory.
    """
    if checkpoint_dir:
        os.makedirs(checkpoint_dir, exist_ok=True)
        fc_path = os.path.join(checkpoint_dir, "forecasting_lstm.pt")
        rt_path = os.path.join(checkpoint_dir, "routing_drl.pt")
    else:
        fc_path = None
        rt_path = None

    t0 = time.time()
    fc_result = train_forecasting_model(epochs=epochs, lr=lr, save_path=fc_path, quiet=quiet)
    rt_result = train_routing_model(epochs=epochs, lr=lr, save_path=rt_path, quiet=quiet)
    total_time = round(time.time() - t0, 2)

    return {
        "success": True,
        "total_elapsed_seconds": total_time,
        "models": {
            "forecasting": fc_result,
            "routing": rt_result
        }
    }


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train & persist PyTorch neural models for Cognitive Smart Logistics Platform."
    )
    parser.add_argument(
        "--models",
        type=str,
        default="all",
        choices=["all", "forecasting", "routing"],
        help="Models to train: all, forecasting, or routing"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=25,
        help="Number of training epochs (default: 25)"
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=0.005,
        help="Learning rate for AdamW optimizer (default: 0.005)"
    )
    parser.add_argument(
        "--checkpoint-dir",
        type=str,
        default=None,
        help="Optional custom destination directory for .pt checkpoints"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress detailed epoch logs"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    print("=" * 72)
    print("  Cognitive Smart Logistics Platform - PyTorch Model Training Harness")
    print(f"  Target: {args.models.upper()} | Epochs: {args.epochs} | Learning Rate: {args.lr}")
    print("=" * 72)

    if args.models == "all":
        results = train_all_models(
            epochs=args.epochs,
            lr=args.lr,
            checkpoint_dir=args.checkpoint_dir,
            quiet=args.quiet
        )
    elif args.models == "forecasting":
        save_path = os.path.join(args.checkpoint_dir, "forecasting_lstm.pt") if args.checkpoint_dir else None
        res = train_forecasting_model(epochs=args.epochs, lr=args.lr, save_path=save_path, quiet=args.quiet)
        results = {"success": True, "models": {"forecasting": res}}
    elif args.models == "routing":
        save_path = os.path.join(args.checkpoint_dir, "routing_drl.pt") if args.checkpoint_dir else None
        res = train_routing_model(epochs=args.epochs, lr=args.lr, save_path=save_path, quiet=args.quiet)
        results = {"success": True, "models": {"routing": res}}

    print("-" * 72)
    print("  Training Completed Successfully!")
    for name, m_info in results.get("models", {}).items():
        print(f"  - {name.capitalize()}: {m_info['checkpoint_path']} ({m_info['file_size_kb']} KB)")
    print("=" * 72)


if __name__ == "__main__":
    main()
