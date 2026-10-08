const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * iOS 16 is the minimum: Expo Router's native code uses iOS 16 APIs, and
 * current Xcode rejects pods that still declare older deployment targets.
 */
const MINIMUM = '16.0';
const MARKER = '# coastwise-ios-minimum';

function withPodsMinimum(config) {
  return withDangerousMod(config, ['ios', (modConfig) => {
    const podfile = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
    let contents = fs.readFileSync(podfile, 'utf8');
    if (!contents.includes(MARKER)) {
      contents = contents.replace(
        /(post_install do \|installer\|\n)/,
        `$1    ${MARKER}\n    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |build_config|\n        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MINIMUM}\n          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MINIMUM}'\n        end\n      end\n    end\n`,
      );
      fs.writeFileSync(podfile, contents);
    }
    return modConfig;
  }]);
}

function withAppMinimum(config) {
  return withXcodeProject(config, (modConfig) => {
    const configurations = modConfig.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (entry && typeof entry === 'object' && entry.buildSettings?.IPHONEOS_DEPLOYMENT_TARGET) {
        entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = MINIMUM;
      }
    }
    return modConfig;
  });
}

module.exports = (config) => withAppMinimum(withPodsMinimum(config));
