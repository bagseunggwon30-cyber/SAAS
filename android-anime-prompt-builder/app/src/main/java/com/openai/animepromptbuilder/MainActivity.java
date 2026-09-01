package com.openai.animepromptbuilder;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final int REQ_IMPORT_HTML = 1001;
    private static final int REQ_WEB_FILE = 1002;
    private static final String APP_HTML_NAME = "anime_prompt_builder.html";

    private WebView webView;
    private ValueCallback<Uri[]> webFileCallback;
    private Button importButton;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(183, 178, 169));

        webView = new WebView(this);
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        root.addView(webView, webParams);

        importButton = new Button(this);
        importButton.setText("HTML 불러오기");
        importButton.setTextSize(12f);
        importButton.setAllCaps(false);
        importButton.setBackgroundColor(Color.rgb(207, 201, 192));
        importButton.setTextColor(Color.rgb(55, 50, 46));
        int padH = dp(12);
        int padV = dp(6);
        importButton.setPadding(padH, padV, padH, padV);
        FrameLayout.LayoutParams buttonParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                dp(44)
        );
        buttonParams.gravity = Gravity.TOP | Gravity.END;
        buttonParams.topMargin = dp(10);
        buttonParams.rightMargin = dp(10);
        root.addView(importButton, buttonParams);

        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppChromeClient());

        importButton.setOnClickListener(v -> chooseHtml());
        importButton.setOnLongClickListener(v -> {
            Toast.makeText(this, "새 HTML 버전을 선택하면 기존 앱 화면을 교체합니다.", Toast.LENGTH_SHORT).show();
            return true;
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadCurrentHtmlOrWelcome();
        }
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private File currentHtmlFile() {
        return new File(getFilesDir(), APP_HTML_NAME);
    }

    private void loadCurrentHtmlOrWelcome() {
        File html = currentHtmlFile();
        if (html.exists() && html.length() > 0) {
            webView.loadUrl(Uri.fromFile(html).toString());
        } else {
            String welcome = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>" +
                    "body{margin:0;background:#b7b2a9;color:#37322e;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}" +
                    ".card{max-width:560px;background:#c4beb5;padding:24px;border-radius:24px;box-shadow:8px 8px 18px rgba(88,82,74,.25),-6px -6px 16px rgba(235,230,220,.22)}h1{font-size:22px;margin:0 0 12px}p{line-height:1.65;margin:8px 0}.hint{font-size:13px;color:#685f56}" +
                    "</style></head><body><div class='card'><h1>Anime Prompt Builder</h1><p>오른쪽 위 <b>HTML 불러오기</b> 버튼을 눌러 최신 Anime Prompt Builder HTML을 선택하세요.</p><p>한 번 가져오면 앱 내부 저장소에 복사되어 다음 실행부터 바로 열립니다.</p><p class='hint'>v23, v24 같은 새 HTML을 받았을 때도 같은 버튼으로 교체할 수 있습니다.</p></div></body></html>";
            webView.loadDataWithBaseURL("file:///android_asset/", welcome, "text/html", "UTF-8", null);
        }
    }

    private void chooseHtml() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/html");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/html", "application/xhtml+xml", "text/plain"});
        try {
            startActivityForResult(intent, REQ_IMPORT_HTML);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "HTML 파일을 선택할 앱을 찾지 못했습니다.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean importHtml(Uri uri) {
        File target = currentHtmlFile();
        try (InputStream in = getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(target, false)) {
            if (in == null) return false;
            byte[] buffer = new byte[32 * 1024];
            int read;
            long total = 0;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                total += read;
            }
            out.flush();
            return total > 128;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_IMPORT_HTML) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                if (importHtml(uri)) {
                    Toast.makeText(this, "HTML을 앱에 저장했습니다.", Toast.LENGTH_SHORT).show();
                    loadCurrentHtmlOrWelcome();
                } else {
                    Toast.makeText(this, "HTML 파일을 가져오지 못했습니다.", Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        if (requestCode == REQ_WEB_FILE) {
            if (webFileCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                webFileCallback.onReceiveValue(result);
                webFileCallback = null;
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show();
        }
    }

    private class AppWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                openExternal(uri);
                return true;
            }
            return false;
        }
    }

    private class AppChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (webFileCallback != null) webFileCallback.onReceiveValue(null);
            webFileCallback = filePathCallback;
            try {
                startActivityForResult(fileChooserParams.createIntent(), REQ_WEB_FILE);
                return true;
            } catch (ActivityNotFoundException e) {
                webFileCallback = null;
                return false;
            }
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
            WebView temp = new WebView(MainActivity.this);
            temp.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    openExternal(request.getUrl());
                    view.destroy();
                    return true;
                }
            });
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(temp);
            resultMsg.sendToTarget();
            return true;
        }
    }
}
