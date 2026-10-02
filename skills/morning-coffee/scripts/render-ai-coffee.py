import os
import json, pathlib, urllib.request, time, wave, re, subprocess
import argparse
parser=argparse.ArgumentParser(description='Render a paragraph-aligned AI coffee episode')
parser.add_argument('input',type=pathlib.Path)
parser.add_argument('output',type=pathlib.Path)
parser.add_argument('--tts-base-url', default=os.environ.get('INDEXTTS_BASE_URL'))
parser.add_argument('--voice', default=os.environ.get('INDEXTTS_VOICE', 'espresso'))
parser.add_argument('--music', type=pathlib.Path, default=os.environ.get('AI_COFFEE_MUSIC'))
parser.add_argument('--music-credit', default=os.environ.get('AI_COFFEE_MUSIC_CREDIT'))
args=parser.parse_args()
if not args.tts_base_url or not args.music or not args.music.is_file() or not args.music_credit:
    parser.error('Provide --tts-base-url, an existing --music file and its --music-credit (or matching environment variables)')
d=json.loads(args.input.read_text())
assert d['segments'] and all(isinstance(x,str) and x.strip() for x in d['segments'])
out=args.output.with_suffix('.parts'); out.mkdir(parents=True,exist_ok=True)
args.output.parent.mkdir(parents=True,exist_ok=True)
parts=[]
for section,text in enumerate(d['segments']):
    sentences=re.findall(r'.+?(?:[。！？]|$)',text)
    chunks=[]; current=''
    for sentence in sentences:
        if current and len(current+sentence)>115:
            chunks.append(current);current=''
        current+=sentence
    if current:chunks.append(current)
    assert ''.join(chunks)==text
    for j,chunk in enumerate(chunks): parts.append({'section':section,'text':chunk,'pause_ms':650 if j==len(chunks)-1 else 220})
assert max(len(p['text']) for p in parts)<=120
start=time.monotonic()
for i,p in enumerate(parts):
    target=out/f'{i:02d}.wav'; t=time.monotonic()
    req=urllib.request.Request(args.tts_base_url.rstrip('/')+'/v1/audio/speech',data=json.dumps({'model':'indextts-2.5','voice':args.voice,'input':p['text'],'response_format':'wav','speed':1.0}).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=300) as r:
        assert r.headers.get('X-Engine')=='indextts-2.5'; target.write_bytes(r.read())
    with wave.open(str(target)) as w:
        assert w.getnframes()>0 and w.getnchannels()==1 and w.getsampwidth()==2
        p.update(path=str(target),seconds=w.getnframes()/w.getframerate(),synthesis_seconds=time.monotonic()-t)
    print(json.dumps({'part':i+1,'total':len(parts),'chars':len(p['text']),'audio_seconds':round(p['seconds'],2),'render_seconds':round(p['synthesis_seconds'],2)}),flush=True)
    (out/'manifest.json').write_text(json.dumps(parts,ensure_ascii=False,indent=2))
joined=out/'joined.wav'
with wave.open(str(joined),'wb') as dest:
    rate=None
    for p in parts:
        with wave.open(p['path'],'rb') as src:
            if rate is None:
                rate=src.getframerate();dest.setnchannels(1);dest.setsampwidth(2);dest.setframerate(rate)
            assert src.getframerate()==rate
            dest.writeframes(src.readframes(src.getnframes()))
            dest.writeframes(b'\x00\x00'*round(rate*p['pause_ms']/1000))
final=args.output.with_name(args.output.stem+'.voice.mp3')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(joined),'-af','loudnorm=I=-19:TP=-1.5:LRA=7','-ar','24000','-ac','1','-codec:a','libmp3lame','-b:a','96k','-metadata','title='+d['title'],'-metadata','comment='+d['disclosure'],str(final)],check=True)
subprocess.run(['ffmpeg','-v','error','-i',str(final),'-f','null','-'],check=True)
import sys
subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('mix-ai-coffee.py')),str(final),str(args.output),'--title',d['title'],'--music',str(args.music),'--music-credit',args.music_credit],check=True)
final=args.output
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(final)]))
report={'file':str(final),'parts':len(parts),'text_chars':sum(len(x['text']) for x in parts),'wall_seconds':time.monotonic()-start,**probe}
(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)); print(json.dumps(report,ensure_ascii=False),flush=True)
