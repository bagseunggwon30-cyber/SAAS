// APK v2 서명 (Android 7.0+ 에서 검증. apksig 2.3.0 의 v1 서명기는 JDK 17+ 에서 동작하지 않아 v2만 사용)
// java -cp apksig.jar:. SignApk <keystore.p12> <storepass> <alias> <in.apk> <out.apk>
import com.android.apksig.ApkSigner;
import java.io.*;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.*;

public class SignApk {
  public static void main(String[] a) throws Exception {
    KeyStore ks = KeyStore.getInstance("PKCS12");
    try (InputStream in = new FileInputStream(a[0])) { ks.load(in, a[1].toCharArray()); }
    PrivateKey key = (PrivateKey) ks.getKey(a[2], a[1].toCharArray());
    X509Certificate cert = (X509Certificate) ks.getCertificate(a[2]);
    ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("DIARY", key, Collections.singletonList(cert)).build();
    new ApkSigner.Builder(Collections.singletonList(sc))
        .setInputApk(new File(a[3])).setOutputApk(new File(a[4]))
        .setV1SigningEnabled(false).setV2SigningEnabled(true)
        .build().sign();
    System.out.println("signed " + a[4]);
  }
}
