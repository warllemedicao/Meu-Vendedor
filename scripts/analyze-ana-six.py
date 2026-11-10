"""Decode the delivered clip fully and preserve technical/temporal review evidence.

Run with NumPy/Pillow available. Metrics locate transitions; they do not certify identity.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import numpy as np
from PIL import Image, ImageDraw

parser=argparse.ArgumentParser()
parser.add_argument('video',type=Path)
parser.add_argument('--ffmpeg',default='/tmp/mv-ana-midi/ffmpeg')
args=parser.parse_args()
video=args.video.resolve()
check=subprocess.run([args.ffmpeg,'-hide_banner','-i',str(video),'-map','0:v:0','-f','null','-'],capture_output=True,text=True)
if check.returncode:raise RuntimeError('full_decode_failed')
duration=re.search(r'Duration: ([0-9:.]+)',check.stderr).group(1)
counts=re.findall(r'frame=\s*(\d+)',check.stderr)
if duration!='00:00:06.00' or int(counts[-1])!=144:raise RuntimeError('expected_144_frames_in_6_seconds')
decoded=subprocess.run([args.ffmpeg,'-v','error','-i',str(video),'-map','0:v:0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
frames=np.frombuffer(decoded,dtype=np.uint8).reshape(-1,848,480,3)
if len(frames)!=144:raise RuntimeError('unexpected_frame_dimensions_or_count')
small=frames[:,::4,::4].astype(np.float32)
diff=np.mean(np.abs(small[1:]-small[:-1]),axis=(1,2,3))
indices=[0,23,46,47,48,49,71,94,95,96,97,119,143]
canvas=Image.new('RGB',(480*4,888*4),'#202020')
draw=ImageDraw.Draw(canvas)
for n,index in enumerate(indices):
 image=Image.fromarray(frames[index]);image.save(video.parent/f'final-frame-{index:03d}.png')
 x,y=(n%4)*480,(n//4)*888
 canvas.paste(image,(x,y));draw.text((x+8,y+855),f'Frame {index}, {index/24:.3f}s',fill='white')
canvas.save(video.parent/'final-contact-sheet.jpg',quality=92)
report={'file':video.name,'duration_seconds':6,'frames':144,'fps':24,'width':480,'height':848,'audio':bool(re.search(r'Stream #.*Audio:',check.stderr)),'full_decode':'passed','bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'mean_adjacent_frame_rgb_difference':float(diff.mean()),'max_adjacent_frame_rgb_difference':float(diff.max()),'transition_difference':{str(i):float(diff[i-1]) for i in (48,96)},'largest_changes_before_frames':[int(i+1) for i in np.argsort(diff)[-8:][::-1]],'quality_certification':False}
(video.parent/'technical-review.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
