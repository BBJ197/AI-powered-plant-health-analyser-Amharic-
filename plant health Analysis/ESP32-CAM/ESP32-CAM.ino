#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <Base64.h>

// ✅ WiFi Credentials
const char* ssid = "bbj";
const char* password = "32145678";

WebServer server(80);

camera_config_t config;

void handleCapture() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "application/json", "{\"error\": \"Camera capture failed\"}");
    return;
  }

  String imageBase64 = base64::encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  String jsonData = "{\"image\": \"" + imageBase64 + "\", \"mime_type\": \"image/jpeg\"}";
  server.send(200, "application/json", jsonData);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  Serial.print("📡 ESP32-CAM IP: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  connectToWiFi();

  // ✅ Camera configuration (classic style to avoid compiler errors)
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sscb_sda = 26;
  config.pin_sscb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA; // 👈 unchanged
  config.jpeg_quality = 12;          // 👈 unchanged
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("❌ Camera init failed");
    return;
  }
  Serial.println("📸 Camera ready");

  server.on("/capture", handleCapture);
  server.begin();
  Serial.println("🌍 Web server started (GET /capture)");
}

void loop() {
  server.handleClient();
}
