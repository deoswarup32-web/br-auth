#pragma once
#include <windows.h>
#include <wininet.h>
#include <string>
#include <sstream>
#include <iostream>
#include <iomanip>

#pragma comment(lib, "wininet.lib")

class AuthClient {
private:
    std::string apiUrl;
    std::string appId;
    std::string sessionToken;

    std::string SendPostRequest(const std::string& endpoint, const std::string& jsonPayload) {
        std::string response = "";
        HINTERNET hSession = InternetOpenA("AuthClient", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
        if (!hSession) return "{\"success\":false,\"message\":\"Failed to open internet session: " + std::to_string(GetLastError()) + "\"}";

        // Parse host and port from apiUrl
        std::string host = "";
        std::string path = endpoint;
        int port = INTERNET_DEFAULT_HTTP_PORT;
        
        std::string urlPrefix = "http://";
        std::string urlSecurePrefix = "https://";
        std::string urlTemp = apiUrl;

        bool isHttps = false;
        if (urlTemp.compare(0, urlSecurePrefix.length(), urlSecurePrefix) == 0) {
            isHttps = true;
            port = INTERNET_DEFAULT_HTTPS_PORT;
            urlTemp = urlTemp.substr(urlSecurePrefix.length());
        }
        else if (urlTemp.compare(0, urlPrefix.length(), urlPrefix) == 0) {
            urlTemp = urlTemp.substr(urlPrefix.length());
        }

        size_t slashPos = urlTemp.find('/');
        if (slashPos != std::string::npos) {
            host = urlTemp.substr(0, slashPos);
            // Append API path
            path = urlTemp.substr(slashPos) + endpoint;
        }
        else {
            host = urlTemp;
        }

        size_t colonPos = host.find(':');
        if (colonPos != std::string::npos) {
            std::string portStr = host.substr(colonPos + 1);
            port = std::stoi(portStr);
            host = host.substr(0, colonPos);
        }

        HINTERNET hConnect = InternetConnectA(hSession, host.c_str(), port, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
        if (!hConnect) {
            InternetCloseHandle(hSession);
            return "{\"success\":false,\"message\":\"Connection failed: " + std::to_string(GetLastError()) + "\"}";
        }

        DWORD flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
        if (isHttps) {
            flags |= INTERNET_FLAG_SECURE | INTERNET_FLAG_IGNORE_CERT_CN_INVALID | INTERNET_FLAG_IGNORE_CERT_DATE_INVALID;
        }

        HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", path.c_str(), NULL, NULL, NULL, flags, 0);
        if (!hRequest) {
            InternetCloseHandle(hConnect);
            InternetCloseHandle(hSession);
            return "{\"success\":false,\"message\":\"Request creation failed: " + std::to_string(GetLastError()) + "\"}";
        }

        // Apply strict SSL verification bypass options to prevent Windows CA certificate errors
        if (isHttps) {
            DWORD dwFlags = 0;
            DWORD dwBuffSize = sizeof(dwFlags);
            InternetQueryOptionA(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwFlags, &dwBuffSize);
            dwFlags |= SECURITY_FLAG_IGNORE_UNKNOWN_CA | 
                       SECURITY_FLAG_IGNORE_WRONG_USAGE | 
                       SECURITY_FLAG_IGNORE_CERT_CN_INVALID | 
                       SECURITY_FLAG_IGNORE_CERT_DATE_INVALID | 
                       SECURITY_FLAG_IGNORE_REVOCATION;
            InternetSetOptionA(hRequest, INTERNET_OPTION_SECURITY_FLAGS, &dwFlags, sizeof(dwFlags));
        }

        std::string headers = "Content-Type: application/json\r\n";
        BOOL sent = HttpSendRequestA(hRequest, headers.c_str(), (DWORD)headers.length(), (LPVOID)jsonPayload.c_str(), (DWORD)jsonPayload.length());
        
        if (sent) {
            char buffer[4096];
            DWORD bytesRead = 0;
            while (InternetReadFile(hRequest, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
                buffer[bytesRead] = '\0';
                response += buffer;
            }
        }
        else {
            response = "{\"success\":false,\"message\":\"Sending request failed: " + std::to_string(GetLastError()) + "\"}";
        }

        InternetCloseHandle(hRequest);
        InternetCloseHandle(hConnect);
        InternetCloseHandle(hSession);
        return response;
    }

    // Helper to extract JSON string fields (lightweight, zero dependency parser)
    std::string ParseJsonField(const std::string& json, const std::string& field) {
        std::string target = "\"" + field + "\":\"";
        size_t pos = json.find(target);
        if (pos == std::string::npos) {
            // Check without quote for booleans
            target = "\"" + field + "\":";
            pos = json.find(target);
            if (pos == std::string::npos) return "";
            
            size_t start = pos + target.length();
            size_t end = json.find_first_of(",}", start);
            if (end == std::string::npos) return "";
            std::string val = json.substr(start, end - start);
            // Trim whitespace
            val.erase(0, val.find_first_not_of(" \t\r\n"));
            val.erase(val.find_last_not_of(" \t\r\n") + 1);
            return val;
        }
        
        size_t start = pos + target.length();
        size_t end = json.find("\"", start);
        if (end == std::string::npos) return "";
        return json.substr(start, end - start);
    }

public:
    AuthClient(const std::string& url, const std::string& application_id = "") : apiUrl(url), appId(application_id) {}

    // HWID generation: CPU ID + Drive C: Serial Number
    static std::string GetHWID() {
        DWORD driveSerial = 0;
        // Fetch serial of system disk (usually C:)
        GetVolumeInformationA("C:\\", NULL, 0, &driveSerial, NULL, NULL, NULL, 0);

        int cpuInfo[4] = { 0, 0, 0, 0 };
        // Fetch CPU details
        __cpuid(cpuInfo, 1);

        std::stringstream ss;
        // Format them as a hex HWID string
        ss << std::hex << std::setfill('0') 
           << std::setw(8) << driveSerial << "-"
           << std::setw(8) << cpuInfo[0] << "-"
           << std::setw(8) << cpuInfo[3];

        std::string rawHwid = ss.str();
        // Convert to uppercase
        for (auto& c : rawHwid) c = toupper(c);
        return rawHwid;
    }

    // Login using License Key only
    bool LoginWithKey(const std::string& key, std::string& outMessage, std::string& outRemaining) {
        std::string hwid = GetHWID();
        
        std::stringstream ss;
        ss << "{\"key\":\"" << key << "\",\"hwid\":\"" << hwid << "\"";
        if (!appId.empty()) {
            ss << ",\"appId\":\"" << appId << "\"";
        }
        ss << "}";

        std::string response = SendPostRequest("/api/client/login-key", ss.str());
        std::string successStr = ParseJsonField(response, "success");
        
        outMessage = ParseJsonField(response, "message");
        if (successStr == "true") {
            sessionToken = ParseJsonField(response, "token");
            outRemaining = ParseJsonField(response, "remaining");
            return true;
        }
        return false;
    }

    // Login using Username + Password
    bool LoginWithUser(const std::string& username, const std::string& password, std::string& outMessage, std::string& outRemaining) {
        std::string hwid = GetHWID();

        std::stringstream ss;
        ss << "{\"username\":\"" << username << "\",\"password\":\"" << password << "\",\"hwid\":\"" << hwid << "\"";
        if (!appId.empty()) {
            ss << ",\"appId\":\"" << appId << "\"";
        }
        ss << "}";

        std::string response = SendPostRequest("/api/client/login-user", ss.str());
        std::string successStr = ParseJsonField(response, "success");

        outMessage = ParseJsonField(response, "message");
        if (successStr == "true") {
            sessionToken = ParseJsonField(response, "token");
            outRemaining = ParseJsonField(response, "remaining");
            return true;
        }
        return false;
    }

    // Verify existing session
    bool VerifySession() {
        if (sessionToken.empty()) return false;

        std::string hwid = GetHWID();
        std::stringstream ss;
        ss << "{\"token\":\"" << sessionToken << "\",\"hwid\":\"" << hwid << "\"";
        if (!appId.empty()) {
            ss << ",\"appId\":\"" << appId << "\"";
        }
        ss << "}";

        std::string response = SendPostRequest("/api/client/verify", ss.str());
        std::string successStr = ParseJsonField(response, "success");
        return (successStr == "true");
    }

    std::string GetToken() const {
        return sessionToken;
    }
};
