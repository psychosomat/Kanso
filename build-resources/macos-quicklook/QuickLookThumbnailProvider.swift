//
//  QuickLookThumbnailProvider.swift
//  Kanso Video Quick Look Generator
//
//  Generates thumbnails for video files in macOS Finder
//

import Cocoa
import QuickLook
import AVFoundation

class QuickLookThumbnailProvider: QLThumbnailProvider {
    
    override func provideThumbnail(for request: QLFileThumbnailRequest, completionHandler: @escaping (QLThumbnailReply?, Error?) -> Void) {
        guard let fileURL = request.fileURL else {
            completionHandler(nil, NSError(domain: "KansoThumbnail", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid file URL"]))
            return
        }
        
        let size = request.maximumSize
        let scale = request.scale
        
        // Generate thumbnail using AVFoundation
        generateThumbnail(from: fileURL, size: size, scale: scale) { image, error in
            if let image = image {
                let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: { ctx in
                    // Draw the image in the context
                    NSGraphicsContext.saveGraphicsState()
                    let context = NSGraphicsContext.current?.cgContext
                    context?.interpolationQuality = .high
                    context?.draw(image.cgImage(forProposedRect: nil, contextSize: size, hints: nil)!, in: CGRect(origin: .zero, size: size))
                    NSGraphicsContext.restoreGraphicsState()
                    return true
                })
                completionHandler(reply, nil)
            } else {
                completionHandler(nil, error)
            }
        }
    }
    
    private func generateThumbnail(from url: URL, size: CGSize, scale: CGFloat, completion: @escaping (NSImage?, Error?) -> Void) {
        let asset = AVAsset(url: url)
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = size
        
        // Get thumbnail at 1 second mark
        let time = CMTime(seconds: 1.0, preferredTimescale: 60)
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let cgImage = try imageGenerator.copyCGImage(at: time, actualTime: nil)
                let nsImage = NSImage(cgImage: cgImage, size: size)
                DispatchQueue.main.async {
                    completion(nsImage, nil)
                }
            } catch {
                // Try to get the first frame if 1 second fails
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
