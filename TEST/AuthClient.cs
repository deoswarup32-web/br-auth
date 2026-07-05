using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Management;
using System.Security.Cryptography;

namespace AuthApp
{
    public class AuthClient
    {
        private readonly string _apiUrl;
        private readonly string _appId;
        private readonly HttpClient _httpClient;
        private string _sessionToken;

        public class AuthResponse
        {
            public bool success { get; set; }
            public string message { get; set; }
            public string token { get; set; }
            public string remaining { get; set; }
        }

        public AuthClient(string apiUrl, string appId)
        {
            _apiUrl = apiUrl.TrimEnd('/');
            _appId = appId;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        }

        public static string GetHWID()
        {
            try
            {
                string hwidSource = "";
                using (var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        hwidSource += obj["ProcessorId"]?.ToString();
                    }
                }
                using (var searcher = new ManagementObjectSearcher("SELECT SerializeNumber FROM Win32_BIOS"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        hwidSource += obj["SerialNumber"]?.ToString();
                    }
                }
                if (string.IsNullOrEmpty(hwidSource))
                {
                    hwidSource = Environment.MachineName + Environment.UserName + Environment.ProcessorCount;
                }

                using (var sha256 = SHA256.Create())
                {
                    byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(hwidSource));
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < bytes.Length; i++)
                    {
                        sb.Append(bytes[i].ToString("X2"));
                    }
                    return sb.ToString().Substring(0, 32);
                }
            }
            catch
            {
                return "FB-CSHARP-FALLBACK-" + Environment.MachineName.ToUpper();
            }
        }

        public async Task<AuthResponse> LoginWithUserAsync(string username, string password)
        {
            try
            {
                string hwid = GetHWID();
                var payloadObj = new
                {
                    username = username,
                    password = password,
                    hwid = hwid,
                    appId = _appId
                };

                string json = Newtonsoft.Json.JsonConvert.SerializeObject(payloadObj);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{_apiUrl}/api/client/login-user", content);
                string responseString = await response.Content.ReadAsStringAsync();

                var authResponse = Newtonsoft.Json.JsonConvert.DeserializeObject<AuthResponse>(responseString);
                if (authResponse != null && authResponse.success)
                {
                    _sessionToken = authResponse.token;
                }
                return authResponse;
            }
            catch (Exception ex)
            {
                return new AuthResponse { success = false, message = "Connection error: " + ex.Message };
            }
        }

        public async Task<AuthResponse> LoginWithKeyAsync(string licenseKey)
        {
            try
            {
                string hwid = GetHWID();
                var payloadObj = new
                {
                    key = licenseKey,
                    hwid = hwid,
                    appId = _appId
                };

                string json = Newtonsoft.Json.JsonConvert.SerializeObject(payloadObj);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{_apiUrl}/api/client/login-key", content);
                string responseString = await response.Content.ReadAsStringAsync();

                var authResponse = Newtonsoft.Json.JsonConvert.DeserializeObject<AuthResponse>(responseString);
                if (authResponse != null && authResponse.success)
                {
                    _sessionToken = authResponse.token;
                }
                return authResponse;
            }
            catch (Exception ex)
            {
                return new AuthResponse { success = false, message = "Connection error: " + ex.Message };
            }
        }
    }
}
