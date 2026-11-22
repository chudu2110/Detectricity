jest.mock('expo/config-plugins', () => ({
  withAppBuildGradle: (config: unknown, mod: (config: unknown) => unknown) => mod(config),
  withDangerousMod: (config: unknown) => config,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configure = require('../plugins/with-android-cmake-dir');

it('adds Windows object-path hashing once and preserves existing app configuration', () => {
  const previous = process.env.WATTPRINT_FORCE_CMAKE_DIR;
  process.env.WATTPRINT_FORCE_CMAKE_DIR = '1';
  try {
    const config = {
      modResults: { contents: 'android { defaultConfig { applicationId "existing.id" } }' },
    };
    const first = configure(config);
    const second = configure(first);
    expect(second.modResults.contents.match(/CMAKE_OBJECT_PATH_MAX=250/g)).toHaveLength(1);
    expect(second.modResults.contents).toContain('applicationId "existing.id"');
  } finally {
    if (previous === undefined) delete process.env.WATTPRINT_FORCE_CMAKE_DIR;
    else process.env.WATTPRINT_FORCE_CMAKE_DIR = previous;
  }
});
