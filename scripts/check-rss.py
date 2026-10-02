"""Check public RSS and podcast enclosure access using urllib's default client identity."""
import argparse
import json
import urllib.request
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base', default='https://blog.wuzhaoyi.xyz/agent-blog/')
args = parser.parse_args()
base = args.base.rstrip('/') + '/'
checked_audio = set()
for path in ['rss.xml', 'episodes/rss.xml']:
    url = base + path
    with urllib.request.urlopen(url, timeout=20) as response:
        assert response.status == 200, url
        assert 'xml' in response.headers.get('Content-Type', ''), url
        root = ET.fromstring(response.read())
    assert root.tag == 'rss', url
    channel = root.find('channel')
    assert channel is not None and channel.findtext('title') and channel.findtext('link'), url
    items = channel.findall('item')
    guids = [item.findtext('guid') for item in items]
    assert all(guids) and len(set(guids)) == len(guids), 'Missing or duplicate item identities'
    for item in items:
        assert item.findtext('pubDate') and item.findtext('link'), 'Missing episode date or page'
        enclosure = item.find('enclosure')
        if enclosure is None:
            continue
        assert enclosure.attrib['type'] == 'audio/mpeg'
        audio_url = enclosure.attrib['url']
        expected = int(enclosure.attrib['length'])
        assert expected > 0
        if audio_url in checked_audio:
            continue
        with urllib.request.urlopen(urllib.request.Request(audio_url, method='HEAD'), timeout=20) as response:
            assert response.status == 200
            assert int(response.headers['Content-Length']) == expected
            assert response.headers['Content-Type'].split(';')[0] == 'audio/mpeg'
        end = min(127, expected - 1)
        with urllib.request.urlopen(urllib.request.Request(audio_url, headers={'Range': f'bytes=0-{end}'}), timeout=20) as response:
            assert response.status == 206
            assert response.headers['Content-Range'] == f'bytes 0-{end}/{expected}'
            assert len(response.read()) == end + 1
        checked_audio.add(audio_url)
    print(json.dumps({'url': url, 'items': len(items), 'status': 'passed'}, ensure_ascii=False))
print(json.dumps({'audioFilesChecked': len(checked_audio), 'status': 'passed'}))
