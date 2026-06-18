import Cocoa
import AVFoundation

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

    override func provideThumbnail(for request: QLFileRequest, completionHandler: @escaping (QLReply?, Error?) -> Void) {
        guard let fileURL = request.fileURL else {
            completionHandler(nil, NSError(domain: "KansoThumbnail", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid file URL"]))
            return
        }

        let size = request.maximumSize

        generateThumbnail(from: fileURL, size: size) { image, error in
            if let image = image {
                if #available(macOS 15.0, *) {
                    let reply = QLThumbnailReply(context: size, currentContextDrawing: { ctx in
                        NSGraphicsContext.saveGraphicsState()
                        let context = NSGraphicsContext.current?.cgContext
                        context?.interpolationQuality = .high
                        let rect = CGRect(origin: .zero, size: size)
                        #if canImport(QuickLookUI)
                        context?.draw(image.cgImage(forProposedRect: nil, context: nil, hints: nil)!, in: rect)
                        #else
                        context?.draw(image.cgImage(forProposedRect: nil, contextSize: size, hints: nil)!, in: rect)
                        #endif
                        NSGraphicsContext.restoreGraphicsState()
                        return true
                    })
                    completionHandler(reply, nil)
                } else {
                    let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: { ctx in
                        NSGraphicsContext.saveGraphicsState()
                        let context = NSGraphicsContext.current?.cgContext
                        context?.interpolationQuality = .high
                        context?.draw(image.cgImage(forProposedRect: nil, contextSize: size, hints: nil)!, in: CGRect(origin: .zero, size: size))
                        NSGraphicsContext.restoreGraphicsState()
                        return true
                    })
                    completionHandler(reply, nil)
                }
            } else {
                completionHandler(nil, error)
            }
        }
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
                let nsImage = NSImage(cgImage: cgImage, size: size)
                DispatchQueue.main.async {
                    completion(nsImage, nil)
                }
            } catch {
                let startTime = CMTime(seconds: 0.0, preferredTimescale: 60)
                do {
                    let cgImage = try imageGenerator.copyCGImage(at: startTime, actualTime: nil)
                    let nsImage = NSImage(cgImage: cgImage, size: size)
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
