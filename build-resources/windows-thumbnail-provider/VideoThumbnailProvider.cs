using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace KansoThumbnailProvider
{
	internal enum WTS_ALPHATYPE : uint
	{
		WTSAT_UNKNOWN = 0,
		WTSAT_RGB = 1,
		WTSAT_ARGB = 2,
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("e357fccd-a995-4576-b01f-234630154c96")]
	internal interface IThumbnailProvider
	{
		void GetThumbnail(uint cx, out IntPtr phbmp, out WTS_ALPHATYPE pdwAlpha);
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("b824b496-5ac0-4b88-a8f2-e2c2c6e7e0a8")]
	internal interface IInitializeWithFile
	{
		void Initialize([MarshalAs(UnmanagedType.LPWStr)] string pszFilePath, uint grfMode);
	}

	internal static class Logger
	{
		private const int MaxLogBytes = 1024 * 1024;
		private static readonly object SyncRoot = new object();
		private static string _logPath;

		private static string LogPath
		{
			get
			{
				if (_logPath == null)
				{
					_logPath = ResolveLogPath();
				}

				return _logPath;
			}
		}

		private static string ResolveLogPath()
		{
			string dir = Path.Combine(
				Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
				"Kanso");

			Directory.CreateDirectory(dir);
			return Path.Combine(dir, "thumbnail-provider.log");
		}

		private static void RollIfNeeded()
		{
			try
			{
				var info = new FileInfo(LogPath);
				if (!info.Exists || info.Length < MaxLogBytes)
				{
					return;
				}

				string rolled = LogPath + ".1";
				if (File.Exists(rolled))
				{
					File.Delete(rolled);
				}

				File.Move(LogPath, rolled);
			}
			catch
			{
			}
		}

		private static void Write(string level, string message)
		{
			try
			{
				lock (SyncRoot)
				{
					RollIfNeeded();
					string line = string.Format(
						"{0:yyyy-MM-dd HH:mm:ss.fff} {1} ] pid={2} {3}{4}",
						DateTime.Now,
						level,
						Process.GetCurrentProcess().Id,
						message,
						Environment.NewLine);
					File.AppendAllText(LogPath, line);
				}
			}
			catch
			{
			}
		}

		internal static void Info(string message)
		{
			Write("INFO", message);
		}

		internal static void Warn(string message)
		{
			Write("WARN", message);
		}

		internal static void Error(string message)
		{
			Write("ERROR", message);
		}
	}

	[ComVisible(true)]
	[Guid("E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B")]
	[ClassInterface(ClassInterfaceType.None)]
	[ProgId("Kanso.VideoThumbnailProvider")]
	public sealed class VideoThumbnailProvider : IThumbnailProvider, IInitializeWithFile
	{
		private const string LogoFileName = "kanso-logo.png";
		private const int FfmpegTimeoutMs = 20000;
		private const int MinLogoCanvasPixels = 64;
		private const string ClsidKey = @"CLSID\{E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}";

		private static readonly object LogoSync = new object();
		private static Bitmap _cachedLogo;

		private string _filePath;

		public void Initialize(string pszFilePath, uint grfMode)
		{
			_filePath = pszFilePath;
			Logger.Info("Initialize(IInitializeWithFile): " + (pszFilePath ?? "<null>"));
		}

		public void GetThumbnail(uint cx, out IntPtr phbmp, out WTS_ALPHATYPE pdwAlpha)
		{
			phbmp = IntPtr.Zero;
			pdwAlpha = WTS_ALPHATYPE.WTSAT_ARGB;

			try
			{
				Logger.Info("GetThumbnail: " + (_filePath ?? "<null>"));

				if (string.IsNullOrWhiteSpace(_filePath) || !File.Exists(_filePath))
				{
					Logger.Warn("GetThumbnail: file missing or path empty: " + (_filePath ?? "<null>"));
					throw new FileNotFoundException("Video file not found.", _filePath);
				}

				int size = cx <= 0 ? 256 : (int)Math.Min(cx, 1024);

				using (Bitmap thumbnail = BuildThumbnail(_filePath, size))
				{
					if (thumbnail == null)
					{
						Logger.Warn("GetThumbnail: BuildThumbnail returned null for " + _filePath);
						throw new COMException("Failed to build thumbnail.", unchecked((int)0x80004005));
					}

					phbmp = thumbnail.GetHbitmap();
				}

				Logger.Info("GetThumbnail: success, " + size + "px for " + _filePath);
			}
			catch (Exception exception)
			{
				if (phbmp != IntPtr.Zero)
				{
					DeleteObject(phbmp);
					phbmp = IntPtr.Zero;
				}

				Logger.Error("GetThumbnail threw: " + exception);
				throw;
			}
		}

		[DllImport("gdi32.dll")]
		private static extern bool DeleteObject(IntPtr hObject);

		private static Bitmap BuildThumbnail(string videoPath, int size)
		{
			string ffmpegPath = LocateFfmpeg();
			if (ffmpegPath == null)
			{
				Logger.Warn("BuildThumbnail: ffmpeg.exe not found; looked relative to assembly and on PATH");
				return null;
			}

			Logger.Info("BuildThumbnail: using ffmpeg=" + ffmpegPath);

			string outputPath = Path.Combine(Path.GetTempPath(), "kanso_thumb_" + Guid.NewGuid().ToString("N") + ".png");

			try
			{
				bool extracted = ExtractFrame(ffmpegPath, videoPath, outputPath, size, "00:00:01");
				if (!extracted)
				{
					extracted = ExtractFrame(ffmpegPath, videoPath, outputPath, size, "00:00:00");
				}

				if (!extracted)
				{
					return null;
				}

				using (Stream stream = File.OpenRead(outputPath))
				using (Image frame = Image.FromStream(stream, false, false))
				{
					var thumbnail = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppArgb);
					thumbnail.SetResolution(96, 96);
					using (Graphics graphics = Graphics.FromImage(thumbnail))
					{
						graphics.DrawImage(frame, 0, 0, frame.Width, frame.Height);
					}

					OverlayLogo(thumbnail);
					return thumbnail;
				}
			}
			catch (Exception exception)
			{
				Logger.Warn("BuildThumbnail threw for " + videoPath + ": " + exception.Message);
				return null;
			}
			finally
			{
				try
				{
					if (File.Exists(outputPath))
					{
						File.Delete(outputPath);
					}
				}
				catch
				{
				}
			}
		}

		private static bool ExtractFrame(string ffmpegPath, string videoPath, string outputPath, int size, string seek)
		{
			string filter = "scale=" + size + ":" + size + ":force_original_aspect_ratio=decrease";
			string arguments = "-y -ss " + seek + " -i \"" + videoPath + "\""
				+ " -frames:v 1 -vf \"" + filter + "\" -f image2 \"" + outputPath + "\"";

			var startInfo = new ProcessStartInfo
			{
				FileName = ffmpegPath,
				Arguments = arguments,
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
			};

			var stderr = new StringBuilder();

			try
			{
				using (var process = new Process { StartInfo = startInfo })
				{
					process.ErrorDataReceived += (sender, args) =>
					{
						if (args.Data != null)
						{
							stderr.AppendLine(args.Data);
						}
					};

					if (!process.Start())
					{
						Logger.Warn("ExtractFrame: Process.Start returned null");
						return false;
					}

					process.BeginErrorReadLine();

					if (!process.WaitForExit(FfmpegTimeoutMs))
					{
						try
						{
							process.Kill();
						}
						catch
						{
						}

						Logger.Warn("ExtractFrame: ffmpeg timed out after " + FfmpegTimeoutMs + "ms");
						return false;
					}

					process.WaitForExit();

					string error = stderr.ToString();
					if (error.Length > 2048)
					{
						error = error.Substring(0, 2048);
					}

					Logger.Info("ExtractFrame: ffmpeg exit=" + process.ExitCode + "; stderr=" + error.Trim());

					if (process.ExitCode != 0)
					{
						return false;
					}

					var output = new FileInfo(outputPath);
					return output.Exists && output.Length > 0;
				}
			}
			catch (Exception exception)
			{
				Logger.Warn("ExtractFrame threw: " + exception.Message);
				return false;
			}
		}

		private static string LocateFfmpeg()
		{
			string assemblyDir = GetAssemblyDirectory();

			string sibling = Path.Combine(assemblyDir, "ffmpeg.exe");
			if (File.Exists(sibling))
			{
				return sibling;
			}

			DirectoryInfo dir = new DirectoryInfo(assemblyDir);
			for (int level = 0; level < 6 && dir != null; level++)
			{
				string candidate = Path.Combine(dir.FullName, "node_modules", "ffmpeg-static", "ffmpeg.exe");
				if (File.Exists(candidate))
				{
					return candidate;
				}

				dir = dir.Parent;
			}

			return LocateFfmpegOnPath();
		}

		private static string LocateFfmpegOnPath()
		{
			try
			{
				var startInfo = new ProcessStartInfo
				{
					FileName = "where",
					Arguments = "ffmpeg",
					UseShellExecute = false,
					CreateNoWindow = true,
					RedirectStandardOutput = true,
					RedirectStandardError = true,
				};

				using (var process = Process.Start(startInfo))
				{
					if (process == null)
					{
						return null;
					}

					string output = process.StandardOutput.ReadToEnd();
					process.WaitForExit(5000);

					if (process.ExitCode != 0)
					{
						return null;
					}

					string[] lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
					foreach (string line in lines)
					{
						string candidate = line.Trim().Trim('"');
						if (candidate.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(candidate))
						{
							return candidate;
						}
					}
				}
			}
			catch
			{
			}

			return null;
		}

		private static string GetAssemblyDirectory()
		{
			return Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
		}

		private static Bitmap TryLoadLogo()
		{
			lock (LogoSync)
			{
				if (_cachedLogo != null)
				{
					return _cachedLogo;
				}

				string logoPath = Path.Combine(GetAssemblyDirectory(), LogoFileName);
				if (!File.Exists(logoPath))
				{
					Logger.Warn("TryLoadLogo: logo not found at " + logoPath);
					return null;
				}

				try
				{
					using (Stream stream = File.OpenRead(logoPath))
					using (Image image = Image.FromStream(stream, false, false))
					{
						_cachedLogo = new Bitmap(image);
					}

					return _cachedLogo;
				}
				catch (Exception exception)
				{
					Logger.Warn("TryLoadLogo threw: " + exception.Message);
					return null;
				}
			}
		}

		private static void OverlayLogo(Bitmap thumbnail)
		{
			if (thumbnail.Width < MinLogoCanvasPixels || thumbnail.Height < MinLogoCanvasPixels)
			{
				return;
			}

			Bitmap logo = TryLoadLogo();
			if (logo == null)
			{
				return;
			}

			int targetWidth = Math.Max(thumbnail.Width / 4, 1);
			int targetHeight = (int)((long)targetWidth * logo.Height / Math.Max(logo.Width, 1));
			int maxHeight = Math.Max(thumbnail.Height / 4, 1);
			if (targetHeight > maxHeight)
			{
				targetHeight = maxHeight;
				targetWidth = (int)((long)targetHeight * logo.Width / Math.Max(logo.Height, 1));
			}

			if (targetWidth <= 0 || targetHeight <= 0)
			{
				return;
			}

			int margin = Math.Max(Math.Min(thumbnail.Width, thumbnail.Height) / 25, 4);
			var logoRect = new Rectangle(
				thumbnail.Width - targetWidth - margin,
				thumbnail.Height - targetHeight - margin,
				targetWidth,
				targetHeight);

			using (Graphics graphics = Graphics.FromImage(thumbnail))
			{
				graphics.SmoothingMode = SmoothingMode.HighQuality;
				graphics.CompositingMode = CompositingMode.SourceOver;
				graphics.CompositingQuality = CompositingQuality.HighQuality;
				graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
				graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

				int pad = Math.Max(Math.Max(targetWidth / 8, targetHeight / 8), 4);
				var backdrop = new Rectangle(
					logoRect.X - pad,
					logoRect.Y - pad,
					logoRect.Width + pad * 2,
					logoRect.Height + pad * 2);

				using (var brush = new SolidBrush(Color.FromArgb(150, 0, 0, 0)))
				{
					graphics.FillEllipse(brush, backdrop);
				}

				graphics.DrawImage(logo, logoRect);
			}
		}

		[ComRegisterFunction]
		public static void ComRegister(Type type)
		{
			try
			{
				Logger.Info("ComRegister: " + type.GUID);

				using (RegistryKey clsid = Registry.ClassesRoot.OpenSubKey(ClsidKey, true))
				{
					if (clsid == null)
					{
						Logger.Warn("ComRegister: CLSID key not found");
						return;
					}

					clsid.SetValue(null, "Kanso Video Thumbnail Provider", RegistryValueKind.String);

					using (RegistryKey server = clsid.OpenSubKey("InprocServer32", true))
					{
						if (server == null)
						{
							Logger.Warn("ComRegister: InprocServer32 key not found");
							return;
						}

						server.SetValue("ThreadingModel", "Both", RegistryValueKind.String);
					}

					clsid.SetValue("DisableLowILProcessIsolation", 1, RegistryValueKind.DWord);
				}

				Logger.Info("ComRegister: registry keys written successfully");
			}
			catch (Exception exception)
			{
				Logger.Error("ComRegister threw: " + exception);
				throw;
			}
		}

		[ComUnregisterFunction]
		public static void ComUnregister(Type type)
		{
			try
			{
				Logger.Info("ComUnregister: " + type.GUID);
				Registry.ClassesRoot.DeleteSubKeyTree(ClsidKey, false);
				Logger.Info("ComUnregister: completed");
			}
			catch (Exception exception)
			{
				Logger.Warn("ComUnregister threw: " + exception.Message);
			}
		}
	}
}
