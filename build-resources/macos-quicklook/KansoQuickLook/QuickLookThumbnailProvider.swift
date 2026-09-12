import Cocoa
import AVFoundation
import ImageIO

#if canImport(QuickLookUI)
import QuickLookUI
#else
import QuickLook
#endif

#if canImport(QuickLookUI)
typealias QLProvider = QLThumbnailProvider
typealias QLFileRequest = QLFileThumbnailRequest
typealias QLReply = QLThumbnailReply
#else
typealias QLProvider = QLThumbnailProvider
typealias QLFileRequest = QLFileThumbnailRequest
typealias QLReply = QLThumbnailReply
#endif

class QuickLookThumbnailProvider: QLProvider {

    private static let logoFileName = "kanso-logo"
    private static let logoFileExtension = "png"
    private static let minLogoCanvas: CGFloat = 64

    override func provideThumbnail(for request: QLFileRequest, completionHandler: @escaping (QLReply?, Error?) -> Void) {
        let fileURL = request.fileURL
        let size = request.maximumSize

        generateThumbnail(from: fileURL, size: size) { image, error in
            guard let image = image else {
                completionHandler(nil, error)
                return
            }

            let reply = QLReply(contextSize: size, currentContextDrawing: {
                guard let context = NSGraphicsContext.current?.cgContext else { return false }
                context.interpolationQuality = .high

                let canvas = CGRect(origin: .zero, size: size)
                context.clear(canvas)

                image.draw(in: self.aspectFit(image.size, in: canvas))
                self.drawLogo(in: context, canvasSize: size)
                return true
            })
            completionHandler(reply, nil)
        }
    }

    private func aspectFit(_ imageSize: CGSize, in canvas: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, canvas.width > 0, canvas.height > 0 else {
            return canvas
        }

        let scale = min(canvas.width / imageSize.width, canvas.height / imageSize.height)
        let fitted = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(
            x: canvas.midX - fitted.width / 2,
            y: canvas.midY - fitted.height / 2,
            width: fitted.width,
            height: fitted.height)
    }

    private func drawLogo(in context: CGContext, canvasSize: CGSize) {
        guard min(canvasSize.width, canvasSize.height) >= Self.minLogoCanvas,
            let logoURL = Bundle(for: type(of: self)).url(forResource: Self.logoFileName, withExtension: Self.logoFileExtension),
            let source = CGImageSourceCreateWithURL(logoURL as CFURL, nil),
            let logo = CGImageSourceCreateImageAtIndex(source, 0, nil),
            logo.width > 0, logo.height > 0
        else {
            return
        }

        let aspect = CGFloat(logo.width) / CGFloat(logo.height)
        var logoWidth = canvasSize.width / 4
        var logoHeight = logoWidth / aspect
        if logoHeight > canvasSize.height / 4 {
            logoHeight = canvasSize.height / 4
            logoWidth = logoHeight * aspect
        }

        let margin = max(min(canvasSize.width, canvasSize.height) / 25, 4)
        let logoRect = CGRect(
            x: canvasSize.width - logoWidth - margin,
            y: margin,
            width: logoWidth,
            height: logoHeight)

        let pad = max(logoWidth / 8, logoHeight / 8, 4)
        context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 0.59))
        context.fillEllipse(in: logoRect.insetBy(dx: -pad, dy: -pad))
        context.draw(logo, in: logoRect)
    }

    private func generateThumbnail(from url: URL, size: CGSize, completion: @escaping (NSImage?, Error?) -> Void) {
        let asset = AVAsset(url: url)
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = size

        let time = CMTime(seconds: 1.0, preferredTimescale: 60)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let cgImage = try imageGenerator.copyCGImage(at: time, actualTime: nil)
                let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
                DispatchQueue.main.async {
                    completion(nsImage, nil)
                }
            } catch {
                let startTime = CMTime(seconds: 0.0, preferredTimescale: 60)
                do {
                    let cgImage = try imageGenerator.copyCGImage(at: startTime, actualTime: nil)
                    let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
                    DispatchQueue.main.async {
                        completion(nsImage, nil)
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion(nil, error)
                    }
                }
            }
        }
    }
}
