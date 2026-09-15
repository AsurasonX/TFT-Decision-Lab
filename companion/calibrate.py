import json
import time
from pathlib import Path

import cv2
import dxcam


BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"
PREVIEW_FILE = BASE_DIR / "stage_region_preview.png"


def load_config():
    if CONFIG_FILE.exists():
        with open(
            CONFIG_FILE,
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    return {
        "api_url": "http://127.0.0.1:8000",
        "game_name": "Asurason",
        "tag_line": "JP1",
        "dxcam_output": 0,
    }


def save_config(config):
    with open(
        CONFIG_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            config,
            file,
            indent=2,
        )


def main():
    config = load_config()

    output_index = int(
        config.get(
            "dxcam_output",
            0,
        )
    )

    print()
    print("==================================")
    print("TFT Decision Lab")
    print("DXCAM CALIBRATION")
    print("==================================")
    print()

    print(
        f"DXcam output: {output_index}"
    )

    print()
    print(
        "IMPORTANT:"
    )

    print(
        "TFT must be visible on screen "
        "when the screenshot is taken."
    )

    print()
    print(
        "After pressing ENTER, you have "
        "5 seconds to switch back to TFT."
    )

    input(
        "\nPress ENTER when ready..."
    )

    print()
    print(
        "Switch to TFT now..."
    )

    for seconds in range(
        5,
        0,
        -1,
    ):
        print(seconds)
        time.sleep(1)

    camera = dxcam.create(
        output_idx=output_index,
        output_color="BGR",
    )

    frame = camera.grab()

    if frame is None:
        raise RuntimeError(
            "DXcam could not capture the screen."
        )

    # Save full capture for debugging.
    full_file = (
        BASE_DIR
        / "calibration_fullscreen.png"
    )

    cv2.imwrite(
        str(full_file),
        frame,
    )

    print()
    print(
        "Screenshot captured."
    )

    print(
        "A selection window will now open."
    )

    print()
    print(
        "Select ONLY the TFT phase text."
    )

    print(
        "Example:"
    )

    print(
        "3-6"
    )

    print()
    print(
        "Do NOT include:"
    )

    print(
        "- the icon on the left"
    )

    print(
        "- large background areas"
    )

    print(
        "- other UI elements"
    )

    print()

    x, y, width, height = (
        cv2.selectROI(
            "Select TFT Phase Text",
            frame,
            showCrosshair=True,
            fromCenter=False,
        )
    )

    cv2.destroyAllWindows()

    if (
        width <= 0
        or height <= 0
    ):
        print(
            "Calibration cancelled."
        )
        return

    left = int(x)
    top = int(y)

    right = int(
        x + width
    )

    bottom = int(
        y + height
    )

    region = [
        left,
        top,
        right,
        bottom,
    ]

    config[
        "capture_region"
    ] = region

    config[
        "dxcam_output"
    ] = output_index

    save_config(
        config
    )

    preview = frame[
        top:bottom,
        left:right,
    ]

    cv2.imwrite(
        str(PREVIEW_FILE),
        preview,
    )

    print()
    print(
        "Calibration complete."
    )

    print()
    print(
        f"Capture region: {region}"
    )

    print()
    print(
        "Preview saved to:"
    )

    print(
        PREVIEW_FILE
    )

    print()
    print(
        "Full DXcam screenshot saved to:"
    )

    print(
        full_file
    )

    del camera


if __name__ == "__main__":
    main()