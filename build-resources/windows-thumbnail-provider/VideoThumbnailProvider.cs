using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using System.Text;
using Microsoft.Win32;

namespace KansoThumbnailProvider
{
	public enum WTS_ALPHATYPE : uint
	{
		WTSAT_UNKNOWN = 0,
		WTSAT_RGB = 1,
		WTSAT_ARGB = 2,
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("e357fccd-a995-4576-b01f-234630154e96")]
	public interface IThumbnailProvider
	{
		void GetThumbnail(uint cx, out IntPtr phbmp, out WTS_ALPHATYPE pdwAlpha);
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("b7d14566-0509-4cce-a71f-0a554233bd9b")]
	public interface IInitializeWithFile
	{
		void Initialize([MarshalAs(UnmanagedType.LPWStr)] string pszFilePath, uint grfMode);
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
	public interface IShellItem
	{
		void BindToHandler(IntPtr pbc, [In] ref Guid bhid, [In] ref Guid riid, out IntPtr ppv);
		void GetParent(out IShellItem ppsi);
		[PreserveSig]
		int GetDisplayName(uint sigdnName, out IntPtr ppszName);
		void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
		void Compare(IShellItem psi, uint hint, out int piOrder);
	}

	[ComImport]
	[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
	[Guid("7f73be3f-fb79-493c-a6c7-7ee14e245841")]
	public interface IInitializeWithItem
	{
		void Initialize([MarshalAs(UnmanagedType.Interface)] IShellItem psi, uint grfMode);
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
	public sealed class VideoThumbnailProvider : IThumbnailProvider, IInitializeWithItem, IInitializeWithFile
	{
		private const string LogoFileName = "kanso-logo.png";
		private const int FfmpegTimeoutMs = 20000;
		private const int MinLogoCanvasPixels = 64;
		private const uint SigdnFileSysPath = 0x80058000u;
		private const uint BiRgb = 0;
		private const uint DibRgbColors = 0;
		private const string ClsidGuid = "{E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}";
		private const string ClsidKey = @"CLSID\" + ClsidGuid;
		private const string ApprovedKey = @"Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved";
		private const string ProviderDisplayName = "Kanso Video Thumbnail Provider";

		private static readonly object LogoSync = new object();
		private static Bitmap _cachedLogo;

		private string _filePath;

		public void Initialize(IShellItem psi, uint grfMode)
		{
			if (psi == null)
			{
				throw new ArgumentNullException("psi");
			}

			IntPtr pathPtr = IntPtr.Zero;
			try
			{
				int hr = psi.GetDisplayName(SigdnFileSysPath, out pathPtr);
				if (hr != 0 || pathPtr == IntPtr.Zero)
				{
					_filePath = null;
					Logger.Warn("Initialize(IInitializeWithItem): GetDisplayName(SIGDN_FILESYSPATH) failed with hr=0x" + hr.ToString("X8"));
					Marshal.ThrowExceptionForHR(hr != 0 ? hr : unchecked((int)0x80004005));
				}

				_filePath = Marshal.PtrToStringUni(pathPtr);
				Logger.Info("Initialize(IInitializeWithItem): " + (_filePath ?? "<null>"));
			}
			finally
			{
				if (pathPtr != IntPtr.Zero)
				{
					Marshal.FreeCoTaskMem(pathPtr);
				}
			}
		}

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

					phbmp = CreateDibSectionFromBitmap(thumbnail);
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

		[StructLayout(LayoutKind.Sequential)]
		private struct BITMAPINFOHEADER
		{
			public uint biSize;
			public int biWidth;
			public int biHeight;
			public ushort biPlanes;
			public ushort biBitCount;
			public uint biCompression;
			public uint biSizeImage;
			public int biXPelsPerMeter;
			public int biYPelsPerMeter;
			public uint biClrUsed;
			public uint biClrImportant;
		}

		[DllImport("gdi32.dll", SetLastError = true)]
		private static extern IntPtr CreateDIBSection(
			IntPtr hdc,
			ref BITMAPINFOHEADER pbmi,
			uint usage,
			out IntPtr ppvBits,
			IntPtr hSection,
			uint offset);

		[DllImport("gdi32.dll")]
		private static extern bool GdiFlush();

		[DllImport("gdi32.dll")]
		private static extern bool DeleteObject(IntPtr hObject);

		/// <summary>
		/// Creates a top-down 32bpp BI_RGB DIB section required by Windows Shell IThumbnailProvider
		/// and copies premultiplied ARGB pixel data into it.
		/// </summary>
		private static IntPtr CreateDibSectionFromBitmap(Bitmap bitmap)
		{
			if (bitmap == null)
			{
				throw new ArgumentNullException("bitmap");
			}

			int width = bitmap.Width;
			int height = bitmap.Height;
			if (width <= 0 || height <= 0)
			{
				throw new ArgumentOutOfRangeException("bitmap", "Thumbnail dimensions must be positive.");
			}

			var header = new BITMAPINFOHEADER
			{
				biSize = (uint)Marshal.SizeOf(typeof(BITMAPINFOHEADER)),
				biWidth = width,
				biHeight = -height,
				biPlanes = 1,
				biBitCount = 32,
				biCompression = BiRgb,
				biSizeImage = (uint)(width * height * 4),
				biXPelsPerMeter = 0,
				biYPelsPerMeter = 0,
				biClrUsed = 0,
				biClrImportant = 0,
			};

			IntPtr bits;
			IntPtr hbmp = CreateDIBSection(IntPtr.Zero, ref header, DibRgbColors, out bits, IntPtr.Zero, 0);
			if (hbmp == IntPtr.Zero || bits == IntPtr.Zero)
			{
				int win32Error = Marshal.GetLastWin32Error();
				if (hbmp != IntPtr.Zero)
				{
					DeleteObject(hbmp);
				}

				throw new Win32Exception(win32Error, "CreateDIBSection failed.");
			}

			try
			{
				var rect = new Rectangle(0, 0, width, height);
				BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppPArgb);
				try
				{
					int rowBytes = width * 4;
					if (data.Stride == rowBytes)
					{
						var buffer = new byte[rowBytes * height];
						Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
						Marshal.Copy(buffer, 0, bits, buffer.Length);
					}
					else
					{
						var rowBuffer = new byte[rowBytes];
						for (int y = 0; y < height; y++)
						{
							IntPtr srcRow = IntPtr.Add(data.Scan0, y * data.Stride);
							IntPtr dstRow = IntPtr.Add(bits, y * rowBytes);
							Marshal.Copy(srcRow, rowBuffer, 0, rowBytes);
							Marshal.Copy(rowBuffer, 0, dstRow, rowBytes);
						}
					}
				}
				finally
				{
					bitmap.UnlockBits(data);
				}

				GdiFlush();
				return hbmp;
			}
			catch
			{
				DeleteObject(hbmp);
				throw;
			}
		}

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
					var thumbnail = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppPArgb);
					thumbnail.SetResolution(96, 96);
					using (Graphics graphics = Graphics.FromImage(thumbnail))
					{
						graphics.Clear(Color.Black);
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

		private static string QuoteArgument(string value)
		{
			if (value == null)
			{
				return "\"\"";
			}

			var sb = new StringBuilder();
			sb.Append('"');
			int pendingBackslashes = 0;

			for (int i = 0; i < value.Length; i++)
			{
				char c = value[i];
				if (c == '\\')
				{
					pendingBackslashes++;
				}
				else if (c == '"')
				{
					sb.Append('\\', pendingBackslashes * 2 + 1);
					sb.Append('"');
					pendingBackslashes = 0;
				}
				else
				{
					if (pendingBackslashes > 0)
					{
						sb.Append('\\', pendingBackslashes);
						pendingBackslashes = 0;
					}

					sb.Append(c);
				}
			}

			if (pendingBackslashes > 0)
			{
				sb.Append('\\', pendingBackslashes * 2);
			}

			sb.Append('"');
			return sb.ToString();
		}

		private static bool ExtractFrame(string ffmpegPath, string videoPath, string outputPath, int size, string seek)
		{
			string filter = "scale=" + size + ":" + size + ":force_original_aspect_ratio=decrease";
			string arguments = "-nostdin -y -ss " + seek
				+ " -i " + QuoteArgument(videoPath)
				+ " -frames:v 1 -vf " + QuoteArgument(filter)
				+ " -f image2 " + QuoteArgument(outputPath);

			var startInfo = new ProcessStartInfo
			{
				FileName = ffmpegPath,
				Arguments = arguments,
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = false,
				RedirectStandardError = true,
			};

			var stderr = new StringBuilder();
			var stderrSync = new object();

			try
			{
				using (var process = new Process { StartInfo = startInfo })
				{
					process.ErrorDataReceived += (sender, args) =>
					{
						if (args.Data != null)
						{
							lock (stderrSync)
							{
								if (stderr.Length < 4096)
								{
									stderr.AppendLine(args.Data);
								}
							}
						}
					};

					if (!process.Start())
					{
						Logger.Warn("ExtractFrame: Process.Start returned false");
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

					string error;
					lock (stderrSync)
					{
						error = stderr.ToString();
					}

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
			if (!string.IsNullOrEmpty(assemblyDir))
			{
				string sibling = Path.Combine(assemblyDir, "ffmpeg.exe");
				if (File.Exists(sibling))
				{
					return sibling;
				}

				string twoUp = Path.GetFullPath(Path.Combine(assemblyDir, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe"));
				if (File.Exists(twoUp))
				{
					return twoUp;
				}

				string unpackedDirect = Path.Combine(assemblyDir, "resources", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe");
				if (File.Exists(unpackedDirect))
				{
					return unpackedDirect;
				}

				DirectoryInfo dir = new DirectoryInfo(assemblyDir);
				for (int level = 0; level < 6 && dir != null; level++)
				{
					string candidate = Path.Combine(dir.FullName, "node_modules", "ffmpeg-static", "ffmpeg.exe");
					if (File.Exists(candidate))
					{
						return candidate;
					}

					string unpackedCandidate = Path.Combine(dir.FullName, "resources", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe");
					if (File.Exists(unpackedCandidate))
					{
						return unpackedCandidate;
					}

					dir = dir.Parent;
				}
			}

			return LocateFfmpegOnPath();
		}

		private static string LocateFfmpegOnPath()
		{
			try
			{
				string pathEnv = Environment.GetEnvironmentVariable("PATH");
				if (!string.IsNullOrEmpty(pathEnv))
				{
					string[] entries = pathEnv.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
					foreach (string rawEntry in entries)
					{
						string entry = rawEntry.Trim().Trim('"');
						if (entry.Length == 0)
						{
							continue;
						}

						try
						{
							string candidate = Path.Combine(entry, "ffmpeg.exe");
							if (File.Exists(candidate))
							{
								return candidate;
							}
						}
						catch
						{
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
			Assembly assembly = Assembly.GetExecutingAssembly();
			string location = assembly.Location;
			if (string.IsNullOrEmpty(location) && !string.IsNullOrEmpty(assembly.CodeBase))
			{
				location = new Uri(assembly.CodeBase).LocalPath;
			}

			return string.IsNullOrEmpty(location) ? null : Path.GetDirectoryName(location);
		}

		private static Bitmap TryLoadLogoLocked()
		{
			if (_cachedLogo != null)
			{
				return _cachedLogo;
			}

			string assemblyDir = GetAssemblyDirectory();
			if (string.IsNullOrEmpty(assemblyDir))
			{
				return null;
			}

			string logoPath = Path.Combine(assemblyDir, LogoFileName);
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

		private static void OverlayLogo(Bitmap thumbnail)
		{
			if (thumbnail.Width < MinLogoCanvasPixels || thumbnail.Height < MinLogoCanvasPixels)
			{
				return;
			}

			lock (LogoSync)
			{
				Bitmap logo = TryLoadLogoLocked();
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
		}

		private static void TrySetApprovedExtension(RegistryKey root)
		{
			try
			{
				using (RegistryKey approved = root.CreateSubKey(ApprovedKey))
				{
					if (approved != null)
					{
						approved.SetValue(ClsidGuid, ProviderDisplayName, RegistryValueKind.String);
					}
				}
			}
			catch (UnauthorizedAccessException ex)
			{
				Logger.Warn("TrySetApprovedExtension(" + root.Name + ") unauthorized: " + ex.Message);
			}
			catch (SecurityException ex)
			{
				Logger.Warn("TrySetApprovedExtension(" + root.Name + ") security error: " + ex.Message);
			}
			catch (Exception ex)
			{
				Logger.Warn("TrySetApprovedExtension(" + root.Name + ") failed: " + ex.Message);
			}
		}

		private static void TryRemoveApprovedExtension(RegistryKey root)
		{
			try
			{
				using (RegistryKey approved = root.OpenSubKey(ApprovedKey, true))
				{
					if (approved != null)
					{
						approved.DeleteValue(ClsidGuid, false);
					}
				}
			}
			catch
			{
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

					clsid.SetValue(null, ProviderDisplayName, RegistryValueKind.String);
					clsid.SetValue("DisableProcessIsolation", 1, RegistryValueKind.DWord);
					clsid.SetValue("DisableLowILProcessIsolation", 1, RegistryValueKind.DWord);

					using (RegistryKey server = clsid.OpenSubKey("InprocServer32", true))
					{
						if (server == null)
						{
							Logger.Warn("ComRegister: InprocServer32 key not found");
							return;
						}

						// Preserve InprocServer32 (Default) = "mscoree.dll" written by RegAsm.
						server.SetValue("ThreadingModel", "Both", RegistryValueKind.String);
					}
				}

				TrySetApprovedExtension(Registry.LocalMachine);
				TrySetApprovedExtension(Registry.CurrentUser);

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
				TryRemoveApprovedExtension(Registry.LocalMachine);
				TryRemoveApprovedExtension(Registry.CurrentUser);
				Logger.Info("ComUnregister: completed");
			}
			catch (Exception exception)
			{
				Logger.Warn("ComUnregister threw: " + exception.Message);
			}
		}
	}
}
