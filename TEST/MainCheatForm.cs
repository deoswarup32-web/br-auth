using System;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace AuthApp
{
    public class MainCheatForm : Form
    {
        private Panel headerPanel;
        private Label titleLabel;
        private Label closeButton;
        private Label footerLabel;
        
        // Control Options
        private CheckBox chkAimbot;
        private CheckBox chkWallhack;
        private CheckBox chkESP;
        private CheckBox chkNoRecoil;
        private TrackBar trackAimbotFov;
        private Label lblFovVal;

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        public MainCheatForm()
        {
            InitializeFormStyle();
            CreateCustomUI();
        }

        private void InitializeFormStyle()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.Width = 400;
            this.Height = 320;
            this.BackColor = Color.FromArgb(10, 10, 12);
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
                Text = "BR REGEDIT CHEAT PANEL",
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
                Location = new Point(365, 13),
                Cursor = Cursors.Hand,
                AutoSize = true
            };
            closeButton.Click += (s, e) => Application.Exit();
            closeButton.MouseEnter += (s, e) => closeButton.ForeColor = Color.Red;
            closeButton.MouseLeave += (s, e) => closeButton.ForeColor = Color.Gray;
            headerPanel.Controls.Add(closeButton);

            this.Controls.Add(headerPanel);

            // Group Box style panel for hacks list
            Panel hacksPanel = new Panel
            {
                Location = new Point(20, 70),
                Width = 360,
                Height = 220,
                BackColor = Color.FromArgb(15, 15, 18),
                Padding = new Padding(15)
            };

            chkAimbot = CreateStyledCheckBox("Aimbot Active", 20, hacksPanel);
            chkWallhack = CreateStyledCheckBox("3D Wallhack / Chams", 55, hacksPanel);
            chkESP = CreateStyledCheckBox("Line ESP & Distance", 90, hacksPanel);
            chkNoRecoil = CreateStyledCheckBox("Ultra No Recoil (100%)", 125, hacksPanel);

            // FOV Slider
            Label lblFov = new Label
            {
                Text = "AIM FOV:",
                ForeColor = Color.Gray,
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                Location = new Point(20, 165),
                Width = 60,
                Height = 20
            };
            hacksPanel.Controls.Add(lblFov);

            trackAimbotFov = new TrackBar
            {
                Minimum = 10,
                Maximum = 180,
                Value = 90,
                Location = new Point(90, 160),
                Width = 200,
                Height = 30,
                TickStyle = TickStyle.None
            };
            
            lblFovVal = new Label
            {
                Text = "90°",
                ForeColor = Color.Red,
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                Location = new Point(300, 165),
                Width = 40,
                Height = 20
            };
            
            trackAimbotFov.Scroll += (s, e) => lblFovVal.Text = trackAimbotFov.Value + "°";

            hacksPanel.Controls.Add(trackAimbotFov);
            hacksPanel.Controls.Add(lblFovVal);

            this.Controls.Add(hacksPanel);
        }

        private CheckBox CreateStyledCheckBox(string text, int top, Panel container)
        {
            var cb = new CheckBox
            {
                Text = text,
                Top = top,
                Left = 20,
                Width = 320,
                Height = 25,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            cb.CheckedChanged += (s, e) =>
            {
                cb.ForeColor = cb.Checked ? Color.Red : Color.White;
            };
            container.Controls.Add(cb);
            return cb;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var pen = new Pen(Color.FromArgb(50, Color.Red), 2))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, this.Width - 1, this.Height - 1);
            }
        }
    }
}
