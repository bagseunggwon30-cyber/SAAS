"""zip 다시 쓰기: 내용·압축 방식은 그대로, 무압축 항목만 데이터 시작을 4바이트 경계로 (zipalign 대용)
사용: python3 tools/align.py <in.apk> <out.apk>"""
import sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
with open(dst, 'wb') as fh:
    z = zipfile.ZipFile(fh, 'w')
    for info in zin.infolist():
        data = zin.read(info)
        zi = zipfile.ZipInfo(info.filename, info.date_time)
        zi.compress_type = info.compress_type
        zi.external_attr = info.external_attr
        if info.compress_type == zipfile.ZIP_STORED:
            hdr = 30 + len(info.filename.encode())
            zi.extra = b'\x00' * ((4 - (fh.tell() + hdr) % 4) % 4)
        z.writestr(zi, data)
    z.close()
print('aligned', dst)
