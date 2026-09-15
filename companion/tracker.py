import json
import re
import time
from pathlib import Path
from urllib.parse import quote

import cv2
import dxcam
import easyocr
import numpy as np
import requests


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"

DEBUG_RAW_FILE = BASE_DIR / "debug_live_capture.png"
DEBUG_OCR_FILE = BASE_DIR / "debug_easyocr_live.png"
DEBUG_CHANGE_FILE = BASE_DIR / "debug_phase_change.png"


# =========================================================
# EASYOCR
# =========================================================

print("Loading EasyOCR...")

reader = easyocr.Reader(
    ["en"],
    gpu=False,
)

print("EasyOCR loaded.")


# =========================================================
# CONFIG
# =========================================================

def load_config():
    if not CONFIG_FILE.exists():
        raise RuntimeError(
            "companion/config.json not found.\n"
            "Run:\n"
            "python companion\\calibrate.py"
        )

    with open(
        CONFIG_FILE,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def get_capture_region(config):
    value = (
        config.get("capture_region")
        or config.get("region")
    )

    if value is None:
        raise RuntimeError(
            "No capture region found.\n"
            "Run calibrate.py again."
        )

    if isinstance(value, (list, tuple)):
        if len(value) != 4:
            raise RuntimeError(
                "Capture region must contain 4 numbers."
            )

        return tuple(
            int(number)
            for number in value
        )

    if isinstance(value, dict):

        left = int(value["left"])
        top = int(value["top"])

        if (
            "right" in value
            and "bottom" in value
        ):
            right = int(value["right"])
            bottom = int(value["bottom"])

        elif (
            "width" in value
            and "height" in value
        ):
            right = (
                left
                + int(value["width"])
            )

            bottom = (
                top
                + int(value["height"])
            )

        else:
            raise RuntimeError(
                "Invalid capture region."
            )

        return (
            left,
            top,
            right,
            bottom,
        )

    raise RuntimeError(
        "Invalid capture region."
    )


# =========================================================
# PHASE LOGIC
# =========================================================

def phase_index(phase):
    stage, round_number = phase

    return (
        (stage - 2) * 7
        + (round_number - 1)
    )


def next_phase(phase):
    stage, round_number = phase

    if round_number < 7:
        return (
            stage,
            round_number + 1,
        )

    return (
        stage + 1,
        1,
    )


def is_forward_phase(
    old_phase,
    new_phase,
):
    if old_phase is None:
        return True

    return (
        phase_index(new_phase)
        >
        phase_index(old_phase)
    )


def phase_text(phase):
    if phase is None:
        return "None"

    return (
        f"{phase[0]}-"
        f"{phase[1]}"
    )


# =========================================================
# API
# =========================================================

def get_api_url(config):
    return config.get(
        "api_url",
        "http://127.0.0.1:8000",
    ).rstrip("/")


def get_player(config):
    return (
        config.get(
            "game_name",
            "Asurason",
        ),
        config.get(
            "tag_line",
            "JP1",
        ),
    )


def get_active_game(config):
    api_url = get_api_url(config)

    game_name, tag_line = (
        get_player(config)
    )

    name = quote(
        game_name,
        safe="",
    )

    tag = quote(
        tag_line,
        safe="",
    )

    url = (
        f"{api_url}"
        f"/api/games/active/"
        f"{name}/{tag}"
    )

    try:

        response = requests.get(
            url,
            timeout=2,
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()

        data = response.json()

        if (
            isinstance(data, dict)
            and isinstance(
                data.get("game"),
                dict,
            )
        ):
            return data["game"]

        if (
            isinstance(data, dict)
            and data.get("id") is not None
        ):
            return data

        return None

    except requests.RequestException:
        return None


def send_phase(
    config,
    game_id,
    phase,
    source,
):
    stage, round_number = phase

    url = (
        f"{get_api_url(config)}"
        f"/api/games/"
        f"{game_id}"
        f"/live-phase"
    )

    response = requests.post(
        url,
        json={
            "stage": stage,
            "round": round_number,
            "source": source,
        },
        timeout=3,
    )

    response.raise_for_status()


# =========================================================
# IMAGE PREPARATION
# =========================================================

def create_ocr_image(frame):
    """
    Uses the exact approach that successfully
    recognized 2-4 with near-100% confidence.
    """

    cv2.imwrite(
        str(DEBUG_RAW_FILE),
        frame,
    )

    large = cv2.resize(
        frame,
        None,
        fx=10,
        fy=10,
        interpolation=cv2.INTER_CUBIC,
    )

    gray = cv2.cvtColor(
        large,
        cv2.COLOR_BGR2GRAY,
    )

    _, binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY
        + cv2.THRESH_OTSU,
    )

    binary = cv2.copyMakeBorder(
        binary,
        30,
        30,
        30,
        30,
        cv2.BORDER_CONSTANT,
        value=0,
    )

    cv2.imwrite(
        str(DEBUG_OCR_FILE),
        binary,
    )

    return binary


def create_change_image(frame):
    """
    Smaller binary representation used only
    for detecting visual phase changes.
    """

    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY,
    )

    large = cv2.resize(
        gray,
        None,
        fx=4,
        fy=4,
        interpolation=cv2.INTER_CUBIC,
    )

    _, binary = cv2.threshold(
        large,
        0,
        255,
        cv2.THRESH_BINARY
        + cv2.THRESH_OTSU,
    )

    cv2.imwrite(
        str(DEBUG_CHANGE_FILE),
        binary,
    )

    return binary


def difference_score(
    first,
    second,
):
    if (
        first is None
        or second is None
        or first.shape != second.shape
    ):
        return 1.0

    difference = cv2.absdiff(
        first,
        second,
    )

    return float(
        np.mean(difference)
        / 255.0
    )


# =========================================================
# EASYOCR RECOGNITION
# =========================================================

def normalize_ocr_text(text):
    text = text.strip()

    replacements = {
        "—": "-",
        "–": "-",
        "−": "-",
        "_": "-",
        "~": "-",

        "O": "0",
        "o": "0",

        "I": "1",
        "l": "1",
        "|": "1",
    }

    for old, new in replacements.items():
        text = text.replace(
            old,
            new,
        )

    return text


def parse_phase(text):
    normalized = (
        normalize_ocr_text(text)
    )

    match = re.search(
        r"([2-9])\s*-\s*([1-7])",
        normalized,
    )

    if match:
        return (
            int(match.group(1)),
            int(match.group(2)),
        )

    # In case OCR removes the dash:
    # 36 -> 3-6
    digits = re.sub(
        r"[^0-9]",
        "",
        normalized,
    )

    if len(digits) == 2:

        stage = int(
            digits[0]
        )

        round_number = int(
            digits[1]
        )

        if (
            2 <= stage <= 9
            and 1 <= round_number <= 7
        ):
            return (
                stage,
                round_number,
            )

    return None


def recognize_phase(frame):
    image = create_ocr_image(
        frame
    )

    height, width = (
        image.shape
    )

    horizontal_list = [
        [
            0,
            width,
            0,
            height,
        ]
    ]

    try:

        results = reader.recognize(
            image,
            horizontal_list=horizontal_list,
            free_list=[],
            allowlist="123456789-",
            detail=1,
            paragraph=False,
        )

    except Exception as error:

        print(
            "EasyOCR error:",
            repr(error),
        )

        return (
            None,
            None,
            0.0,
        )

    best_phase = None
    best_text = None
    best_confidence = -1.0

    for result in results:

        if len(result) < 3:
            continue

        text = result[1]

        try:
            confidence = float(
                result[2]
            )

        except (
            TypeError,
            ValueError,
        ):
            confidence = 0.0

        phase = parse_phase(
            text
        )

        if (
            phase is not None
            and confidence
            > best_confidence
        ):
            best_phase = phase
            best_text = text
            best_confidence = confidence

    return (
        best_phase,
        best_text,
        best_confidence,
    )


# =========================================================
# MAIN
# =========================================================

def main():
    config = load_config()

    region = get_capture_region(
        config
    )

    output_index = int(
        config.get(
            "dxcam_output",
            0,
        )
    )

    # -----------------------------------------------------
    # SETTINGS
    # -----------------------------------------------------

    MIN_CONFIDENCE = 0.55

    FIRST_PHASE_READS_REQUIRED = 2

    # If OCR says exactly the phase we expect,
    # one strong reading is enough.
    EXPECTED_READS_REQUIRED = 1

    # Bigger jumps require repeated confirmation.
    JUMP_READS_REQUIRED = 3
    JUMP_MIN_CONFIDENCE = 0.80

    LOOP_DELAY = 0.20

    # Visual fallback.
    VISUAL_CHANGE_THRESHOLD = float(
        config.get(
            "visual_change_threshold",
            0.045,
        )
    )

    VISUAL_STABLE_THRESHOLD = float(
        config.get(
            "visual_stable_threshold",
            0.012,
        )
    )

    VISUAL_CHANGE_FRAMES = 2
    VISUAL_STABLE_FRAMES = 4

    VISUAL_COOLDOWN_SECONDS = 0.8

    # -----------------------------------------------------
    # START
    # -----------------------------------------------------

    print()
    print(
        "=================================="
    )
    print(
        "TFT Decision Lab"
    )
    print(
        "EASYOCR HYBRID PHASE TRACKER"
    )
    print(
        "=================================="
    )
    print()

    print(
        f"DXcam output: "
        f"{output_index}"
    )

    print(
        f"Capture region: "
        f"{region}"
    )

    print()
    print(
        "EasyOCR reads the actual TFT phase."
    )

    print(
        "Visual detection is the fallback."
    )

    print()
    print(
        "Waiting for ACTIVE "
        "Decision Lab session..."
    )

    print()
    print(
        "Press Ctrl+C to stop."
    )
    print()

    camera = dxcam.create(
        output_idx=output_index,
        output_color="BGR",
    )

    current_game_id = None

    last_sent_phase = None

    last_candidate = None
    candidate_count = 0

    jump_candidate = None
    jump_count = 0

    last_debug = None
    last_rejected = None

    visual_baseline = None
    previous_visual = None

    visual_change_count = 0
    visual_stable_count = 0

    visual_change_detected = False

    last_phase_sent_time = 0.0

    try:

        while True:

            # =================================================
            # FIND ACTIVE DECISION LAB GAME
            # =================================================

            active_game = get_active_game(
                config
            )

            if not active_game:

                current_game_id = None
                last_sent_phase = None

                last_candidate = None
                candidate_count = 0

                jump_candidate = None
                jump_count = 0

                visual_baseline = None
                previous_visual = None

                visual_change_count = 0
                visual_stable_count = 0

                visual_change_detected = False

                time.sleep(1)
                continue

            game_id = active_game.get(
                "id"
            )

            if game_id is None:
                time.sleep(1)
                continue

            # =================================================
            # NEW GAME
            # =================================================

            if game_id != current_game_id:

                current_game_id = (
                    game_id
                )

                last_sent_phase = None

                last_candidate = None
                candidate_count = 0

                jump_candidate = None
                jump_count = 0

                visual_baseline = None
                previous_visual = None

                visual_change_count = 0
                visual_stable_count = 0

                visual_change_detected = False

                last_debug = None
                last_rejected = None

                print()
                print(
                    f"Connected to "
                    f"Game #{game_id}"
                )

                print(
                    "Reading TFT phase..."
                )

                print()
                print(
                    "Switch to TFT now."
                )

                print(
                    "Capture begins in "
                    "5 seconds..."
                )

                for seconds in range(
                    5,
                    0,
                    -1,
                ):
                    print(seconds)
                    time.sleep(1)

                print(
                    "Capture started."
                )
                print()

            # =================================================
            # CAPTURE TFT REGION
            # =================================================

            frame = camera.grab(
                region=region
            )

            if frame is None:

                time.sleep(
                    LOOP_DELAY
                )

                continue

            visual_frame = (
                create_change_image(
                    frame
                )
            )

            if visual_baseline is None:

                visual_baseline = (
                    visual_frame.copy()
                )

                previous_visual = (
                    visual_frame.copy()
                )

            # =================================================
            # EASYOCR
            # =================================================

            (
                detected_phase,
                raw_text,
                confidence,
            ) = recognize_phase(
                frame
            )

            phase_was_sent = False

            if (
                detected_phase is not None
                and confidence
                >= MIN_CONFIDENCE
            ):

                debug_value = (
                    f"{raw_text}|"
                    f"{confidence:.3f}|"
                    f"{phase_text(detected_phase)}"
                )

                if debug_value != last_debug:

                    print(
                        f"OCR: "
                        f"{raw_text!r} "
                        f"({confidence:.3f}) "
                        f"→ "
                        f"{phase_text(detected_phase)}"
                    )

                    last_debug = (
                        debug_value
                    )

                # =============================================
                # FIRST PHASE
                # =============================================

                if last_sent_phase is None:

                    if (
                        detected_phase
                        == last_candidate
                    ):
                        candidate_count += 1

                    else:

                        last_candidate = (
                            detected_phase
                        )

                        candidate_count = 1

                    if (
                        candidate_count
                        >= FIRST_PHASE_READS_REQUIRED
                    ):

                        try:

                            send_phase(
                                config,
                                game_id,
                                detected_phase,
                                "SCREEN_EASYOCR",
                            )

                            last_sent_phase = (
                                detected_phase
                            )

                            last_phase_sent_time = (
                                time.time()
                            )

                            print()
                            print(
                                "Initial phase "
                                "detected "
                                f"→ "
                                f"{phase_text(detected_phase)}"
                            )

                            print(
                                "Sent to Decision Lab."
                            )
                            print()

                            phase_was_sent = True

                        except requests.RequestException as error:

                            print(
                                "FastAPI error:"
                            )

                            print(error)

                # =============================================
                # SAME PHASE
                # =============================================

                elif (
                    detected_phase
                    == last_sent_phase
                ):

                    last_candidate = None
                    candidate_count = 0

                    jump_candidate = None
                    jump_count = 0

                # =============================================
                # BACKWARD OCR
                # =============================================

                elif not is_forward_phase(
                    last_sent_phase,
                    detected_phase,
                ):

                    rejection = (
                        f"{phase_text(last_sent_phase)} "
                        f"→ "
                        f"{phase_text(detected_phase)}"
                    )

                    if rejection != last_rejected:

                        print(
                            "Rejected backward OCR: "
                            f"{rejection}"
                        )

                        last_rejected = (
                            rejection
                        )

                else:

                    expected = next_phase(
                        last_sent_phase
                    )

                    # =========================================
                    # EXACTLY EXPECTED NEXT PHASE
                    # =========================================

                    if detected_phase == expected:

                        if (
                            detected_phase
                            == last_candidate
                        ):
                            candidate_count += 1

                        else:

                            last_candidate = (
                                detected_phase
                            )

                            candidate_count = 1

                        if (
                            candidate_count
                            >= EXPECTED_READS_REQUIRED
                        ):

                            try:

                                send_phase(
                                    config,
                                    game_id,
                                    detected_phase,
                                    "SCREEN_EASYOCR",
                                )

                                last_sent_phase = (
                                    detected_phase
                                )

                                last_phase_sent_time = (
                                    time.time()
                                )

                                print()
                                print(
                                    "Phase detected "
                                    f"→ "
                                    f"{phase_text(detected_phase)}"
                                )

                                print(
                                    "Sent to Decision Lab."
                                )
                                print()

                                phase_was_sent = True

                            except requests.RequestException as error:

                                print(
                                    "FastAPI error:"
                                )

                                print(error)

                    # =========================================
                    # OCR SKIPPED ONE OR MORE PHASES
                    # =========================================

                    else:

                        if (
                            detected_phase
                            == jump_candidate
                        ):

                            jump_count += 1

                        else:

                            jump_candidate = (
                                detected_phase
                            )

                            jump_count = 1

                            print(
                                "Forward OCR jump: "
                                f"{phase_text(last_sent_phase)} "
                                f"→ "
                                f"{phase_text(detected_phase)}"
                            )

                            print(
                                "Expected: "
                                f"{phase_text(expected)}"
                            )

                        if (
                            jump_count
                            >= JUMP_READS_REQUIRED
                            and confidence
                            >= JUMP_MIN_CONFIDENCE
                        ):

                            try:

                                print()
                                print(
                                    "Repeated OCR jump "
                                    "confirmed."
                                )

                                print(
                                    "Resynchronizing "
                                    f"→ "
                                    f"{phase_text(detected_phase)}"
                                )

                                send_phase(
                                    config,
                                    game_id,
                                    detected_phase,
                                    "SCREEN_EASYOCR_RESYNC",
                                )

                                last_sent_phase = (
                                    detected_phase
                                )

                                last_phase_sent_time = (
                                    time.time()
                                )

                                print(
                                    "Sent to Decision Lab."
                                )
                                print()

                                phase_was_sent = True

                            except requests.RequestException as error:

                                print(
                                    "FastAPI error:"
                                )

                                print(error)

            # =================================================
            # SUCCESSFUL OCR = NEW VISUAL BASELINE
            # =================================================

            if phase_was_sent:

                visual_baseline = (
                    visual_frame.copy()
                )

                previous_visual = (
                    visual_frame.copy()
                )

                visual_change_count = 0
                visual_stable_count = 0

                visual_change_detected = False

                last_candidate = None
                candidate_count = 0

                jump_candidate = None
                jump_count = 0

                time.sleep(
                    LOOP_DELAY
                )

                continue

            # =================================================
            # VISUAL FALLBACK
            # =================================================

            if (
                last_sent_phase is not None
                and visual_baseline is not None
                and previous_visual is not None
            ):

                now = time.time()

                baseline_difference = (
                    difference_score(
                        visual_frame,
                        visual_baseline,
                    )
                )

                frame_difference = (
                    difference_score(
                        visual_frame,
                        previous_visual,
                    )
                )

                if not visual_change_detected:

                    if (
                        baseline_difference
                        > VISUAL_CHANGE_THRESHOLD
                    ):

                        visual_change_count += 1

                    else:

                        visual_change_count = 0

                    if (
                        visual_change_count
                        >= VISUAL_CHANGE_FRAMES
                    ):

                        visual_change_detected = (
                            True
                        )

                        visual_stable_count = 0

                else:

                    if (
                        frame_difference
                        < VISUAL_STABLE_THRESHOLD
                    ):

                        visual_stable_count += 1

                    else:

                        visual_stable_count = 0

                    if (
                        visual_stable_count
                        >= VISUAL_STABLE_FRAMES
                        and
                        (
                            now
                            - last_phase_sent_time
                        )
                        >= VISUAL_COOLDOWN_SECONDS
                    ):

                        inferred_phase = (
                            next_phase(
                                last_sent_phase
                            )
                        )

                        try:

                            print()
                            print(
                                "OCR missed the phase."
                            )

                            print(
                                "Visual fallback "
                                f"→ "
                                f"{phase_text(inferred_phase)}"
                            )

                            send_phase(
                                config,
                                game_id,
                                inferred_phase,
                                "SCREEN_VISUAL_FALLBACK",
                            )

                            last_sent_phase = (
                                inferred_phase
                            )

                            last_phase_sent_time = (
                                time.time()
                            )

                            print(
                                "Sent to Decision Lab."
                            )
                            print()

                            visual_baseline = (
                                visual_frame.copy()
                            )

                            visual_change_count = 0
                            visual_stable_count = 0

                            visual_change_detected = (
                                False
                            )

                            last_candidate = None
                            candidate_count = 0

                            jump_candidate = None
                            jump_count = 0

                        except requests.RequestException as error:

                            print(
                                "FastAPI error:"
                            )

                            print(error)

            previous_visual = (
                visual_frame.copy()
            )

            time.sleep(
                LOOP_DELAY
            )

    except KeyboardInterrupt:

        print()
        print(
            "Tracker stopped."
        )

    finally:

        del camera


if __name__ == "__main__":
    main()