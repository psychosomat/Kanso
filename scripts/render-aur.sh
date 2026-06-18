#!/usr/bin/env bash
set -euo pipefail

# Generate kanso-bin AUR packaging files (PKGBUILD + .SRCINFO).
# Usage: ./scripts/render-aur.sh <version-without-v> <source-url> <sha256>
#
# The SOURCE_URL should point to the Linux x64 .tar.gz release artifact, e.g.:
#   https://github.com/psychosomat/Kanso/releases/download/v0.1.5/Kanso-0.1.5-linux-x64.tar.gz

if [ "$#" -ne 3 ]; then
    echo "usage: $0 <version-without-v> <source-url> <sha256>" >&2
    exit 1
fi

VERSION="$1"
SOURCE_URL="$2"
SOURCE_SHA="$3"

PACKAGE_NAME="${PACKAGE_NAME:-kanso-bin}"
REPO="${GITHUB_REPOSITORY:-psychosomat/Kanso}"
OUT_DIR="${OUT_DIR:-packaging/aur}"
LOGO_URL="https://raw.githubusercontent.com/${REPO}/v${VERSION}/public/logo512.png"

mkdir -p "$OUT_DIR"

cat > "${OUT_DIR}/PKGBUILD" <<EOF
pkgname=${PACKAGE_NAME}
pkgver=${VERSION}
pkgrel=1
pkgdesc="Modern media player focused on convenience, beauty, and performance"
arch=("x86_64")
url="https://github.com/${REPO}"
license=("MIT")
depends=(
  "gtk3"
  "libsecret"
  "nss"
  "alsa-lib"
)
optdepends=(
  "ffmpeg: broader codec support from the system stack"
)
provides=("kanso")
conflicts=("kanso")
source_x86_64=("kanso-\${pkgver}.tar.gz::${SOURCE_URL}"
           "logo512.png::${LOGO_URL}")
sha256sums_x86_64=("${SOURCE_SHA}"
             "SKIP")

package() {
  install -dm755 "\${pkgdir}/opt/kanso"
  cp -a "\${srcdir}/Kanso-\${pkgver}-linux-x64/"* "\${pkgdir}/opt/kanso/"

  install -dm755 "\${pkgdir}/usr/bin"
  ln -sf "/opt/kanso/kanso" "\${pkgdir}/usr/bin/kanso"

  install -Dm644 "\${srcdir}/logo512.png" \\
    "\${pkgdir}/usr/share/pixmaps/kanso.png"

  install -Dm644 /dev/stdin "\${pkgdir}/usr/share/applications/kanso.desktop" <<'DESKTOP'
[Desktop Entry]
Name=Kanso
Exec=/usr/bin/kanso %U
Terminal=false
Type=Application
Icon=kanso
StartupWMClass=Kanso
Categories=AudioVideo;Video;
MimeType=video/mp4;video/x-matroska;video/webm;video/quicktime;video/x-msvideo;video/x-m4v;video/mp2t;
DESKTOP
}
EOF

cat > "${OUT_DIR}/.SRCINFO" <<EOF
pkgbase = ${PACKAGE_NAME}
	pkgdesc = Modern media player focused on convenience, beauty, and performance
	pkgver = ${VERSION}
	pkgrel = 1
	url = https://github.com/${REPO}
	arch = x86_64
	license = MIT
	depends = gtk3
	depends = libsecret
	depends = nss
	depends = alsa-lib
	optdepends = ffmpeg: broader codec support from the system stack
	provides = kanso
	conflicts = kanso
	source_x86_64 = kanso-${VERSION}.tar.gz::${SOURCE_URL}
	source_x86_64 = logo512.png::${LOGO_URL}
	sha256sums_x86_64 = ${SOURCE_SHA}
	sha256sums_x86_64 = SKIP

pkgname = ${PACKAGE_NAME}
EOF

echo "Generated AUR packaging files in ${OUT_DIR}:"
ls -l "${OUT_DIR}/PKGBUILD" "${OUT_DIR}/.SRCINFO"
