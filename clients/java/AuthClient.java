package auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;

public class AuthClient {
    private final String apiUrl;
    private final String appId;
    private final HttpClient httpClient;
    private String sessionToken;

    public static class AuthResponse {
        public boolean success;
        public String message;
        public String token;
        public String remaining;

        @Override
        public String toString() {
            return "AuthResponse{" +
                    "success=" + success +
                    ", message='" + message + '\'' +
                    ", token='" + token + '\'' +
                    ", remaining='" + remaining + '\'' +
                    '}';
        }
    }

    public AuthClient(String apiUrl) {
        this(apiUrl, "");
    }

    public AuthClient(String apiUrl, String appId) {
        this.apiUrl = apiUrl.endsWith("/") ? apiUrl.substring(0, apiUrl.length() - 1) : apiUrl;
        this.appId = appId;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    // HWID generation in Java
    public static String getHWID() {
        try {
            // Combine operating system and hardware details
            String mainInfo = System.getProperty("os.name") +
                              System.getProperty("os.arch") +
                              System.getProperty("os.version") +
                              System.getProperty("user.name") +
                              System.getenv("PROCESSOR_IDENTIFIER") +
                              System.getenv("COMPUTERNAME");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(mainInfo.getBytes(StandardCharsets.UTF_8));
            
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().substring(0, 32).toUpperCase();
        } catch (Exception e) {
            return "FB-JAVA-FALLBACK-" + System.getProperty("user.name").toUpperCase();
        }
    }

    // Direct Login using License Key only
    public AuthResponse loginWithKey(String licenseKey) {
        String hwid = getHWID();
        String jsonPayload;
        if (appId == null || appId.isEmpty()) {
            jsonPayload = String.format("{\"key\":\"%s\",\"hwid\":\"%s\"}", licenseKey, hwid);
        } else {
            jsonPayload = String.format("{\"key\":\"%s\",\"hwid\":\"%s\",\"appId\":\"%s\"}", licenseKey, hwid, appId);
        }
        return sendRequest("/api/client/login-key", jsonPayload);
    }

    // Login using Username + Password
    public AuthResponse loginWithUser(String username, String password) {
        String hwid = getHWID();
        String jsonPayload;
        if (appId == null || appId.isEmpty()) {
            jsonPayload = String.format("{\"username\":\"%s\",\"password\":\"%s\",\"hwid\":\"%s\"}", username, password, hwid);
        } else {
            jsonPayload = String.format("{\"username\":\"%s\",\"password\":\"%s\",\"hwid\":\"%s\",\"appId\":\"%s\"}", username, password, hwid, appId);
        }
        return sendRequest("/api/client/login-user", jsonPayload);
    }

    // Verify Session
    public boolean verifySession() {
        if (sessionToken == null || sessionToken.isEmpty()) {
            return false;
        }

        String hwid = getHWID();
        String jsonPayload;
        if (appId == null || appId.isEmpty()) {
            jsonPayload = String.format("{\"token\":\"%s\",\"hwid\":\"%s\"}", sessionToken, hwid);
        } else {
            jsonPayload = String.format("{\"token\":\"%s\",\"hwid\":\"%s\",\"appId\":\"%s\"}", sessionToken, hwid, appId);
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + "/api/client/verify"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200 && response.body().contains("\"success\":true");
        } catch (Exception e) {
            return false;
        }
    }

    private AuthResponse sendRequest(String endpoint, String jsonPayload) {
        AuthResponse authResponse = new AuthResponse();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + endpoint))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body();
            
            authResponse.success = response.statusCode() == 200;
            authResponse.message = parseJsonField(responseBody, "message");
            
            if (authResponse.success) {
                authResponse.token = parseJsonField(responseBody, "token");
                authResponse.remaining = parseJsonField(responseBody, "remaining");
                this.sessionToken = authResponse.token;
            }
        } catch (Exception e) {
            authResponse.success = false;
            authResponse.message = "Connection error: " + e.getMessage();
        }
        return authResponse;
    }

    // Simple JSON value extractor (prevents requiring Gson / Jackson library imports)
    private String parseJsonField(String json, String field) {
        String pattern = "\"" + field + "\":\"";
        int index = json.indexOf(pattern);
        if (index == -1) {
            pattern = "\"" + field + "\":";
            index = json.indexOf(pattern);
            if (index == -1) return null;
            int startIdx = index + pattern.length();
            int endIdx = json.indexOf(",", startIdx);
            if (endIdx == -1) endIdx = json.indexOf("}", startIdx);
            return json.substring(startIdx, endIdx).trim().replace("\"", "");
        }
        int start = index + pattern.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}
