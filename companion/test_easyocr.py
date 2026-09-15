import cv2
import easyocr
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = (
    BASE_DIR
    / "debug_live_capture.png"
)

OUTPUT_FILE = (
    BASE_DIR
    / "debug_easyocr.png"
)


print("Loading EasyOCR...")

reader = easyocr.Reader(
    ["en"],
    gpu=False,
)

print("EasyOCR loaded.")


image = cv2.imread(
    str(INPUT_FILE)
)

if image is None:
    raise RuntimeError(
        "Could not open "
        "debug_live_capture.png"
    )


# TFT text is tiny, so enlarge it heavily.
large = cv2.resize(
    image,
    None,
    fx=10,
    fy=10,
    interpolation=cv2.INTER_CUBIC,
)


gray = cv2.cvtColor(
    large,
    cv2.COLOR_BGR2GRAY,
)


# Increase contrast.
_, binary = cv2.threshold(
    gray,
    0,
    255,
    cv2.THRESH_BINARY
    + cv2.THRESH_OTSU,
)


# Add some whitespace around the text.
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
    str(OUTPUT_FILE),
    binary,
)


height, width = (
    binary.shape
)


# IMPORTANT:
# We already know the entire image contains
# only one phase label.
#
# So we bypass EasyOCR's text detector and
# tell the recognizer exactly where the text is.
horizontal_list = [
    [
        0,
        width,
        0,
        height,
    ]
]


results = reader.recognize(
    binary,
    horizontal_list=horizontal_list,
    free_list=[],
    allowlist="123456789-",
    detail=1,
    paragraph=False,
)


print()
print("==============================")
print("RESULTS")
print("==============================")
print()

print(results)

print()
print(
    f"Debug image: "
    f"{OUTPUT_FILE}"
)