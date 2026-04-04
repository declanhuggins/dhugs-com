return {
  LrSdkVersion = 13.0,
  LrSdkMinimumVersion = 10.0,
  LrToolkitIdentifier = "com.dhugs.lightroom.publish",
  LrPluginName = "dhugs.com Publish",
  LrPluginInfoUrl = "https://dhugs.com",

  LrExportServiceProvider = {
    title = "dhugs.com",
    file = "DhugsPublishProvider.lua",
  },

  LrLibraryMenuItems = {
    { title = "Publish Album Folder...", file = "PublishFolder.lua" },
  },

  VERSION = { major = 2, minor = 0, revision = 0, display = "2.0.0" },
}
