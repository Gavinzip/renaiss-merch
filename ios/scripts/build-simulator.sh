#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h:h}"
build_dir="${RENAISS_IOS_BUILD_DIR:-${TMPDIR}renaiss-merch-ios}"
destination="${RENAISS_IOS_DESTINATION:-generic/platform=iOS Simulator}"
xcodebuild -project "$project_dir/RenaissMerch.xcodeproj" \
  -scheme RenaissMerch -configuration Debug -destination "$destination" \
  -derivedDataPath "$build_dir" build CODE_SIGN_IDENTITY=-
print -r -- "Simulator app: $build_dir/Build/Products/Debug-iphonesimulator/RenaissMerch.app"
