"""
download_skills.py

Automated script to download and install agent skills for the
Smart Logistics Digital Twin & 3D GLB Asset Pipeline.
"""

import sys
import shutil
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Skills tailored for Three.js, GLTF/GLB workflows, Materials, Lighting, and Cesium
SKILLS_TO_INSTALL = [
    {
        "name": "threejs-loaders",
        "package": "cloudai-x/threejs-skills@threejs-loaders",
        "description": "GLTFLoader, GLTFExporter, DRACO compression, texture optimization"
    },
    {
        "name": "threejs-materials",
        "package": "cloudai-x/threejs-skills@threejs-materials",
        "description": "PBR materials, emissive day/night maps, shader uniforms"
    },
    {
        "name": "threejs-geometry",
        "package": "cloudai-x/threejs-skills@threejs-geometry",
        "description": "Procedural curve/spline extrusion, road quad ribbons, geometry merging"
    },
    {
        "name": "threejs-lighting",
        "package": "cloudai-x/threejs-skills@threejs-lighting",
        "description": "Lighting management, day/night cycles, shadows, emissive radiance"
    },
    {
        "name": "threejs-animation",
        "package": "cloudai-x/threejs-skills@threejs-animation",
        "description": "Traffic pulses, vehicle animation paths, camera interpolation"
    },
    {
        "name": "threejs-gltf-loading",
        "package": "gamedev-skills/awesome-gamedev-agent-skills@threejs-gltf-loading",
        "description": "Robust async GLTF loading, LODs, bounding-box centering and normalization"
    },
    {
        "name": "cesiumjs-models-particles",
        "package": "cesiumgs/cesiumjs-skills@cesiumjs-models-particles",
        "description": "3D glTF model binding in Cesium, spatial math transforms, particles"
    },
    {
        "name": "cesiumjs-3d-tiles",
        "package": "cesiumgs/cesiumjs-skills@cesiumjs-3d-tiles",
        "description": "Cesium 3D Tileset loading, styling, and level-of-detail optimization"
    },
    {
        "name": "playwright-best-practices",
        "package": "currents-dev/playwright-best-practices-skill@playwright-best-practices",
        "description": "Automated end-to-end browser testing for WebGL and 3D UI"
    }
]


def check_prerequisites():
    """Verify npx is installed and reachable."""
    npx_path = shutil.which("npx")
    if not npx_path:
        print("[!] Error: 'npx' command not found in PATH.")
        print("Please ensure Node.js and npm are installed.")
        sys.exit(1)
    print(f"[OK] Found npx: {npx_path}")


def install_skill(item: dict) -> bool:
    """Install a single skill using npx skills add."""
    pkg = item["package"]
    name = item["name"]
    desc = item["description"]

    print(f"\n" + "=" * 50)
    print(f"[>>] Installing: {name}")
    print(f"     Package:    {pkg}")
    print(f"     Purpose:    {desc}")
    print("=" * 50)

    cmd = ["npx", "skills", "add", pkg, "-y"]

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180
        )

        if result.returncode == 0:
            print(f"[SUCCESS] Successfully installed {name}!")
            if result.stdout:
                lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
                for l in lines[-4:]:
                    print(f"   {l}")
            return True
        else:
            print(f"[FAIL] Failed to install {name} (Exit code {result.returncode})")
            if result.stderr:
                print(f"   Stderr: {result.stderr.strip()}")
            elif result.stdout:
                print(f"   Stdout: {result.stdout.strip()}")
            return False

    except subprocess.TimeoutExpired:
        print(f"[TIMEOUT] Timed out while installing {name}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error installing {name}: {e}")
        return False


def main():
    print("Starting Automated Agent Skills Downloader")
    print(f"Targeting {len(SKILLS_TO_INSTALL)} relevant skills for 3D & Digital Twin pipeline...\n")

    check_prerequisites()

    successful = []
    failed = []

    for item in SKILLS_TO_INSTALL:
        success = install_skill(item)
        if success:
            successful.append(item["name"])
        else:
            failed.append(item["name"])

    print("\n" + "=" * 50)
    print("DOWNLOAD SUMMARY")
    print("=" * 50)
    print(f"Total skills processed: {len(SKILLS_TO_INSTALL)}")
    print(f"Successfully installed: {len(successful)} / {len(SKILLS_TO_INSTALL)}")

    if successful:
        print("\nInstalled Skills:")
        for s in successful:
            print(f"  * {s}")

    if failed:
        print("\nFailed Skills:")
        for f in failed:
            print(f"  * {f}")

    dest_dir = Path(".agents") / "skills"
    if dest_dir.exists():
        installed_dirs = [d.name for d in dest_dir.iterdir() if d.is_dir()]
        print(f"\nLocal skill directory (.agents/skills) now contains {len(installed_dirs)} skills:")
        for d in sorted(installed_dirs):
            print(f"   - {d}")

    print("\n[DONE] Finished skills download process.")


if __name__ == "__main__":
    main()
