using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace AuthApp
{
    public class LoginForm : Form
    {
        private readonly AuthClient _authClient;
        
        // UI Controls
        private Panel headerPanel;
        private Label titleLabel;
        private Label closeButton;
        private TabControl authTabControl;
        private TabPage userTabPage;
        private TabPage keyTabPage;
        
        // User Tab Controls
        private TextBox txtUsername;
        private TextBox txtPassword;
        private Button btnUserLogin;
        
        // Key Tab Controls
        private TextBox txtLicenseKey;
        private Button btnKeyLogin;
        
        // Footer
        private Label footerLabel;

        // P/Invoke for Dragging Window
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        public LoginForm()
        {
            // Initialize AuthClient with Backend URL and User's Application ID
            _authClient = new AuthClient("https://br-auth-backend-production.up.railway.app", "i6e6orcvmmrahdev1");
            
            InitializeFormStyle();
            CreateCustomUI();
        }

        private void InitializeFormStyle()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.Width = 360;
            this.Height = 480;
            this.BackColor = Color.FromArgb(10, 10, 12); // Sleek Dark Background
            this.StartPosition = FormStartPosition.CenterScreen;
            this.DoubleBuffered = true;
        }

        private void CreateCustomUI()
        {
            // Header Panel
            headerPanel = new Panel
            {
                Height = 50,
                Dock = DockStyle.Top,
                BackColor = Color.FromArgb(15, 15, 18)
            };
            headerPanel.MouseDown += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                }
            };

            titleLabel = new Label
            {
                Text = "BR REGEDIT AUTH",
                ForeColor = Color.Red,
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Location = new Point(15, 15),
                AutoSize = true
            };
            headerPanel.Controls.Add(titleLabel);

            closeButton = new Label
            {
                Text = "✕",
                ForeColor = Color.Gray,
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Location = new Point(325, 13),
                Cursor = Cursors.Hand,
                AutoSize = true
            };
            closeButton.Click += (s, e) => Application.Exit();
            closeButton.MouseEnter += (s, e) => closeButton.ForeColor = Color.Red;
            closeButton.MouseLeave += (s, e) => closeButton.ForeColor = Color.Gray;
            headerPanel.Controls.Add(closeButton);

            this.Controls.Add(headerPanel);

            // Tab Control
            authTabControl = new TabControl
            {
                Location = new Point(20, 70),
                Width = 320,
                Height = 340,
                SizeMode = TabSizeMode.Fixed,
                ItemSize = new Size(158, 30)
            };
            
            // Custom Tab Styling (Hide standard tabs, create own styled tab headers)
            authTabControl.Appearance = TabAppearance.FlatButtons;
            authTabControl.ItemSize = new Size(0, 1);
            authTabControl.SizeMode = TabSizeMode.Fixed;

            // Styled Tab Header Selector Buttons
            Button tabUserBtn = new Button
            {
                Text = "USER LOGIN",
                Location = new Point(20, 70),
                Width = 158,
                Height = 35,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.Red,
                BackColor = Color.FromArgb(20, 20, 25),
                Cursor = Cursors.Hand
            };
            tabUserBtn.FlatAppearance.BorderSize = 1;
            tabUserBtn.FlatAppearance.BorderColor = Color.Red;

            Button tabKeyBtn = new Button
            {
                Text = "LICENSE KEY",
                Location = new Point(182, 70),
                Width = 158,
                Height = 35,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.Gray,
                BackColor = Color.FromArgb(15, 15, 18),
                Cursor = Cursors.Hand
            };
            tabKeyBtn.FlatAppearance.BorderSize = 0;

            tabUserBtn.Click += (s, e) =>
            {
                authTabControl.SelectedIndex = 0;
                tabUserBtn.ForeColor = Color.Red;
                tabUserBtn.FlatAppearance.BorderSize = 1;
                tabUserBtn.FlatAppearance.BorderColor = Color.Red;
                tabUserBtn.BackColor = Color.FromArgb(20, 20, 25);
                
                tabKeyBtn.ForeColor = Color.Gray;
                tabKeyBtn.FlatAppearance.BorderSize = 0;
                tabKeyBtn.BackColor = Color.FromArgb(15, 15, 18);
            };

            tabKeyBtn.Click += (s, e) =>
            {
                authTabControl.SelectedIndex = 1;
                tabKeyBtn.ForeColor = Color.Red;
                tabKeyBtn.FlatAppearance.BorderSize = 1;
                tabKeyBtn.FlatAppearance.BorderColor = Color.Red;
                tabKeyBtn.BackColor = Color.FromArgb(20, 20, 25);

                tabUserBtn.ForeColor = Color.Gray;
                tabUserBtn.FlatAppearance.BorderSize = 0;
                tabUserBtn.BackColor = Color.FromArgb(15, 15, 18);
            };

            this.Controls.Add(tabUserBtn);
            this.Controls.Add(tabKeyBtn);

            // User Tab Page
            userTabPage = new TabPage { BackColor = Color.FromArgb(10, 10, 12) };
            CreateUserTabUI();
            authTabControl.TabPages.Add(userTabPage);

            // Key Tab Page
            keyTabPage = new TabPage { BackColor = Color.FromArgb(10, 10, 12) };
            CreateKeyTabUI();
            authTabControl.TabPages.Add(keyTabPage);

            authTabControl.Top = 120;
            this.Controls.Add(authTabControl);

            // Footer Label
            footerLabel = new Label
            {
                Text = "BR REGEDIT © 2026 - SECURE LOADER",
                ForeColor = Color.DimGray,
                Font = new Font("Segoe UI", 7, FontStyle.Bold),
                Location = new Point(0, 450),
                Width = 360,
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(footerLabel);
        }

        private void CreateUserTabUI()
        {
            Panel container = new Panel { Dock = DockStyle.Fill };

            Label lblUser = new Label
            {
                Text = "USERNAME",
                ForeColor = Color.Gray,
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                Location = new Point(10, 20),
                Width = 280
            };
            container.Controls.Add(lblUser);

            txtUsername = new TextBox
            {
                Location = new Point(10, 40),
                Width = 280,
                BackColor = Color.FromArgb(25, 25, 30),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10)
            };
            container.Controls.Add(txtUsername);

            Label lblPass = new Label
            {
                Text = "PASSWORD",
                ForeColor = Color.Gray,
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                Location = new Point(10, 90),
                Width = 280
            };
            container.Controls.Add(lblPass);

            txtPassword = new TextBox
            {
                Location = new Point(10, 110),
                Width = 280,
                BackColor = Color.FromArgb(25, 25, 30),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10),
                UseSystemPasswordChar = true
            };
            container.Controls.Add(txtPassword);

            btnUserLogin = new Button
            {
                Text = "SIGN IN",
                Location = new Point(10, 180),
                Width = 280,
                Height = 40,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.Red,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnUserLogin.FlatAppearance.BorderSize = 0;
            btnUserLogin.Click += async (s, e) => await PerformUserLogin();
            container.Controls.Add(btnUserLogin);

            userTabPage.Controls.Add(container);
        }

        private void CreateKeyTabUI()
        {
            Panel container = new Panel { Dock = DockStyle.Fill };

            Label lblKey = new Label
            {
                Text = "LICENSE KEY",
                ForeColor = Color.Gray,
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                Location = new Point(10, 40),
                Width = 280
            };
            container.Controls.Add(lblKey);

            txtLicenseKey = new TextBox
            {
                Location = new Point(10, 65),
                Width = 280,
                BackColor = Color.FromArgb(25, 25, 30),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10)
            };
            container.Controls.Add(txtLicenseKey);

            btnKeyLogin = new Button
            {
                Text = "ACTIVATE LICENSE",
                Location = new Point(10, 140),
                Width = 280,
                Height = 40,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.Red,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnKeyLogin.FlatAppearance.BorderSize = 0;
            btnKeyLogin.Click += async (s, e) => await PerformKeyLogin();
            container.Controls.Add(btnKeyLogin);

            keyTabPage.Controls.Add(container);
        }

        private async Task PerformUserLogin()
        {
            string username = txtUsername.Text.Trim();
            string password = txtPassword.Text.Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                MessageBox.Show("Please enter username and password.", "Required Fields", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnUserLogin.Text = "AUTHENTICATING...";
            btnUserLogin.Enabled = false;

            var result = await _authClient.LoginWithUserAsync(username, password);

            btnUserLogin.Text = "SIGN IN";
            btnUserLogin.Enabled = true;

            if (result.success)
            {
                MessageBox.Show($"Login Success!\nRemaining time: {result.remaining}", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Hide();
                new MainCheatForm().Show();
            }
            else
            {
                MessageBox.Show(result.message, "Login Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async Task PerformKeyLogin()
        {
            string key = txtLicenseKey.Text.Trim();

            if (string.IsNullOrEmpty(key))
            {
                MessageBox.Show("Please enter a license key.", "Required Fields", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnKeyLogin.Text = "ACTIVATING...";
            btnKeyLogin.Enabled = false;

            var result = await _authClient.LoginWithKeyAsync(key);

            btnKeyLogin.Text = "ACTIVATE LICENSE";
            btnKeyLogin.Enabled = true;

            if (result.success)
            {
                MessageBox.Show($"Activation Success!\nRemaining time: {result.remaining}", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Hide();
                new MainCheatForm().Show();
            }
            else
            {
                MessageBox.Show(result.message, "Activation Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            
            // Draw custom modern glowing border
            using (var pen = new Pen(Color.FromArgb(50, Color.Red), 2))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, this.Width - 1, this.Height - 1);
            }
        }
    }
}
