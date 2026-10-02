import argparse
import json
import math
import pathlib
import subprocess

parser = argparse.ArgumentParser(description='Measure chapters from the completed mixed audio and synthesis manifest')
parser.add_argument('--directory', type=pathlib.Path, required=True)
args = parser.parse_args()
root = args.directory
parts = json.loads((root / 'episode.parts/manifest.json').read_text())
publication = json.loads((root / 'publication.json').read_text())
if not (root / 'episode.parts/result.json').is_file():
    parser.error('Renderer completion result.json is missing')
audio = root / 'episode.mp3'
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(audio)]))
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(audio), '-f', 'null', '-'], check=True)
duration = float(probe['format']['duration'])
if not math.isfinite(duration) or duration <= 3 or not parts:
    parser.error('Completed measured audio is required')
position = 3.0
starts = {}
for part in parts:
    seconds, pause = part['seconds'], part['pause_ms']
    if not isinstance(part['section'], int) or not math.isfinite(seconds) or seconds <= 0 or not math.isfinite(pause) or pause < 0:
        parser.error('Invalid segment measurements')
    starts.setdefault(part['section'], position)
    position += seconds + pause / 1000
if position > duration + 1 or duration - position > 10:
    parser.error('Measured parts do not match the final mixed audio')
chapters = publication['chapters']
if not 4 <= len(chapters) <= 6:
    parser.error('Select four to six chapters')
measured = []
previous = -1
for chapter in chapters:
    start = starts.get(chapter['section'])
    if not chapter.get('title') or start is None or start <= previous or start >= duration:
        parser.error('Chapter references must exist and increase')
    whole = math.floor(start)
    measured.append({'title': chapter['title'], 'start': round(start, 3), 'timestamp': f'{whole // 60:02d}:{whole % 60:02d}'})
    previous = start
if measured[0]['start'] != 3:
    parser.error('The first chapter must include the opening')
result = {'duration': duration, 'bytes': audio.stat().st_size, 'chapters': measured}
(root / 'chapters.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
