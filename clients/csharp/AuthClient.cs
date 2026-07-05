using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Security.Cryptography;
using System.Management; // Need to reference System.Management in project references

namespace AuthSystem
{
    public class AuthResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string Token { get; set; }
        public string Remaining { get; set; }
    }

    public class AuthClient
    {
        private readonly string _apiUrl;
        private readonly string _appId;
        private readonly HttpClient _httpClient;
        private string _sessionToken;

        public AuthClient(string apiUrl, string appId = "")
        {
            _apiUrl = apiUrl.TrimEnd('/');
            _appId = appId;
            _httpClient = new HttpClient();
        }

        // Generate HWID using CPU Id and Disk Serial
        public static string GetHWID()
        {
            try
            {
                string hwidSource = "";

                // Get CPU ID
                using (var mc = new ManagementClass("Win32_Processor"))
                using (var moc = mc.GetInstances())
                {
                    foreach (var mo in moc)
                    {
                        hwidSource += mo.Properties["ProcessorId"]?.Value?.ToString();
                        break; // Get first cpu
                    }
                }

                // Get System Disk Serial
                string drive = Path.GetPathRoot(Environment.SystemDirectory); // e.g. "C:\\"
                string driveLetter = drive.Substring(0, 2); // e.g. "C:"
                using (var disk = new ManagementObject($"Win32_LogicalDisk.DeviceID=\"{driveLetter}\""))
                {
                    disk.Get();
                    hwidSource += disk["VolumeSerialNumber"]?.ToString();
                }

                // Hash the combined values to get a clean HWID string
                using (var sha = SHA256.Create())
                {
                    byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(hwidSource));
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < bytes.Length; i++)
                    {
                        sb.Append(bytes[i].ToString("x2"));
                    }
                    return sb.ToString().Substring(0, 32).ToUpper();
                }
            }
            catch (Exception ex)
            {
                // Fallback for cases where WMI fails
                string fallback = Environment.MachineName + Environment.UserName + Environment.ProcessorCount;
                using (var sha = SHA256.Create())
                {
                    byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(fallback));
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < bytes.Length; i++)
                    {
                        sb.Append(bytes[i].ToString("x2"));
                    }
                    return "FB-" + sb.ToString().Substring(0, 29).ToUpper();
                }
            }
        }

        // Login using license key only
        public async Task<AuthResponse> LoginWithKeyAsync(string licenseKey)
        {
            string hwid = GetHWID();
            string jsonPayload = $"{{\"key\":\"{licenseKey}\",\"hwid\":\"{hwid}\"";
            if (!string.IsNullOrEmpty(_appId))
            {
                jsonPayload += $",\"appId\":\"{_appId}\"";
            }
            jsonPayload += "}";
            
            return await SendRequestAsync("/api/client/login-key", jsonPayload);
        }

        // Login using username + password
        public async Task<AuthResponse> LoginWithUserAsync(string username, string password)
        {
            string hwid = GetHWID();
            string jsonPayload = $"{{\"username\":\"{username}\",\"password\":\"{password}\",\"hwid\":\"{hwid}\"";
            if (!string.IsNullOrEmpty(_appId))
            {
                jsonPayload += $",\"appId\":\"{_appId}\"";
            }
            jsonPayload += "}";
            
            return await SendRequestAsync("/api/client/login-user", jsonPayload);
        }

        // Verify existing session
        public async Task<bool> VerifySessionAsync()
        {
            if (string.IsNullOrEmpty(_sessionToken)) return false;

            string hwid = GetHWID();
            string jsonPayload = $"{{\"token\":\"{_sessionToken}\",\"hwid\":\"{hwid}\"";
            if (!string.IsNullOrEmpty(_appId))
            {
                jsonPayload += $",\"appId\":\"{_appId}\"";
            }
            jsonPayload += "}";

            try
            {
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_apiUrl}/api/client/verify", content);
                string responseBody = await response.Content.ReadAsStringAsync();
                
                // Simple JSON parsing (avoiding heavy external dependencies like Newtonsoft.Json)
                return response.IsSuccessStatusCode && responseBody.Contains("\"success\":true");
            }
            catch
            {
                return false;
            }
        }

        private async Task<AuthResponse> SendRequestAsync(string endpoint, string jsonPayload)
        {
            var result = new AuthResponse();
            try
            {
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{_apiUrl}{endpoint}", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                bool success = response.IsSuccessStatusCode;
                result.Success = success;

                // Parse message
                result.Message = ExtractJsonValue(responseBody, "message");
                
                if (success)
                {
                    result.Token = ExtractJsonValue(responseBody, "token");
                    result.Remaining = ExtractJsonValue(responseBody, "remaining");
                    _sessionToken = result.Token;
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Connection error: {ex.Message}";
            }

            return result;
        }

        // Simple helper to extract json fields without libraries
        private string ExtractJsonValue(string json, string key)
        {
            string pattern = $"\"{key}\":\"";
            int index = json.IndexOf(pattern);
            if (index == -1)
            {
                // Try without quotes for boolean/numbers (just in case)
                pattern = $"\"{key}\":";
                index = json.IndexOf(pattern);
                if (index == -1) return null;
                int startIdx = index + pattern.Length;
                int endIdx = json.IndexOf(",", startIdx);
                if (endIdx == -1) endIdx = json.IndexOf("}", startIdx);
                return json.Substring(startIdx, endIdx - startIdx).Trim('\"', ' ', '}');
            }
            int start = index + pattern.Length;
            int end = json.IndexOf("\"", start);
            return json.Substring(start, end - start);
        }
    }
}
