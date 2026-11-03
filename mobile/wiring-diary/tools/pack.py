"""dist/index.html + apk-template → 서명 전 APK (resources.arsc 는 무압축·4바이트 정렬)
사용: python3 tools/pack.py <out_unsigned.apk>"""
import sys, zipfile, os
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
files = [('AndroidManifest.xml', 'apk-template/AndroidManifest.xml', True),
         ('assets/index.html', 'dist/index.html', True),
         ('res/drawable/icon.xml', 'apk-template/res/drawable/icon.xml', True),
         ('resources.arsc', 'apk-template/resources.arsc', False),
         ('classes.dex', 'apk-template/classes.dex', True)]
with open(out, 'wb') as fh:
    z = zipfile.ZipFile(fh, 'w')
    for name, src, deflate in files:
        data = open(os.path.join(here, src), 'rb').read()
        zi = zipfile.ZipInfo(name, (1981, 1, 1, 1, 1, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED if deflate else zipfile.ZIP_STORED
        if not deflate:  # 데이터 시작이 4바이트 경계가 되도록 extra 패딩
            hdr = 30 + len(name.encode())
            pad = (4 - (fh.tell() + hdr) % 4) % 4
            zi.extra = b'\x00' * pad
        z.writestr(zi, data)
    z.close()
print('packed', out)
