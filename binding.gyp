{
  "targets": [{
    "target_name": "unplayplay_native",
    "sources": [
      "native/unplayplay/src/binding.cc",
      "native/unplayplay/src/decrypt_main.cc",
      "native/unplayplay/src/process.cc"
    ],
    "include_dirs": [
      "native/unplayplay/include",
      "<!(node -p \"require('node-addon-api').include.replace(/\\\"/g, '')\")"
    ],
    "dependencies": [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    "cflags!": ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
    "conditions": [
      ["OS=='win'", {
        "msvs_settings": {
          "VCCLCompilerTool": {"ExceptionHandling": 1}
        }
      }],
      ["OS=='mac'", {
        "xcode_settings": {
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "CLANG_CXX_LIBRARY": "libc++",
          "MACOSX_DEPLOYMENT_TARGET": "10.7"
        }
      }]
    ]
  }]
}
