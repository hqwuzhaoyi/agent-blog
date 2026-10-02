import os
import pathlib,subprocess,json,argparse
parser=argparse.ArgumentParser()
parser.add_argument('voice',type=pathlib.Path)
parser.add_argument('output',type=pathlib.Path)
parser.add_argument('--title',default='AI早咖啡')
parser.add_argument('--music', type=pathlib.Path, default=os.environ.get('AI_COFFEE_MUSIC'))
parser.add_argument('--music-credit', default=os.environ.get('AI_COFFEE_MUSIC_CREDIT'))
args=parser.parse_args()
if not args.music or not args.music.is_file() or not args.music_credit:
    parser.error('Provide an existing --music file and its --music-credit')
voice=args.voice; out=args.output
assert voice.resolve()!=out.resolve(), 'Never overwrite narration'
out.parent.mkdir(parents=True,exist_ok=True)
music=args.music
probe=lambda p:json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(p)]))
duration=float(probe(voice)['format']['duration']); intro=3;total=duration+intro+5
# Preserve complete speech. Music normalized separately, then ducked by speech.
filters=(f'[0:a]aresample=48000,aformat=channel_layouts=stereo,adelay=3000|3000,apad=pad_dur=5,asplit=2[v][sc];'
f'[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={total},asetpts=PTS-STARTPTS,loudnorm=I=-27:TP=-3:LRA=7,'
f"volume='if(lt(t,2.5),1,if(lt(t,3.5),1-0.65*(t-2.5),if(lt(t,{duration+intro}),0.35,0.8)))':eval=frame,"
f'afade=t=in:d=0.7,afade=t=out:st={total-3}:d=3[m];'
'[m][sc]sidechaincompress=threshold=0.025:ratio=5:attack=30:release=450:makeup=1[duck];'
'[v][duck]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]')
credit=args.music_credit
subprocess.run(['ffmpeg','-v','error','-y','-i',str(voice),'-stream_loop','-1','-i',str(music),'-filter_complex',filters,'-map','[a]','-t',str(total),'-ar','48000','-c:a','libmp3lame','-b:a','160k','-metadata','title='+args.title,'-metadata','comment='+credit,str(out)],check=True)
subprocess.run(['ffmpeg','-v','error','-i',str(out),'-f','null','-'],check=True)
r=subprocess.run(['ffmpeg','-hide_banner','-i',str(out),'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
metrics=json.JSONDecoder().raw_decode(r.stderr[r.stderr.rfind('{'):])[0];print(json.dumps({'output':str(out),'probe':probe(out),'loudness':metrics},ensure_ascii=False))
out.with_suffix('.credits.txt').write_text(credit+'\n')
