#!/usr/bin/env bash
# 결선 일기장 APK 다시 만들기: index.html 빌드 → 묶기(정렬) → v2 서명 (Android 7.0 이상)
# 사용: KEYSTORE=diary.p12 STOREPASS=... ALIAS=diary APKSIG_JAR=apksig-2.3.0.jar ./build-apk.sh out.apk
# apksig: https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-dist/wiring-diary-ladder.apk}"
: "${KEYSTORE:?KEYSTORE (PKCS12) 경로}" "${STOREPASS:?STOREPASS}" "${APKSIG_JAR:?apksig jar 경로}"
ALIAS="${ALIAS:-diary}"
node build.mjs
TMP="$(mktemp -d)"
python3 tools/pack.py "$TMP/unsigned.apk"
python3 tools/align.py "$TMP/unsigned.apk" "$TMP/aligned.apk"
javac -cp "$APKSIG_JAR" -d "$TMP" tools/SignApk.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$APKSIG_JAR:$TMP" SignApk "$KEYSTORE" "$STOREPASS" "$ALIAS" "$TMP/aligned.apk" "$OUT"   # v2
