#include <napi.h>
#include <string>
#include <cstring>
#include <cstdint>
#include "main.h"

// Helper: hex string → binary
static void hex2bin_napi(const std::string& hex, uint8_t* out, size_t len) {
    for (size_t i = 0; i < len; i++) {
        unsigned int byte;
        sscanf(hex.substr(i * 2, 2).c_str(), "%02x", &byte);
        out[i] = static_cast<uint8_t>(byte);
    }
}

// Helper: binary → hex string
static std::string bin2hex(const uint8_t* data, size_t len) {
    char* buf = new char[len * 2 + 1];
    for (size_t i = 0; i < len; i++) {
        sprintf(buf + i * 2, "%02x", data[i]);
    }
    buf[len * 2] = '\0';
    std::string result(buf);
    delete[] buf;
    return result;
}

// N-API function: deobfuscateKey(fileIdHex, obfuscatedKeyHex)
Napi::Value DeobfuscateKey(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Expected two hex strings: fileId, obfuscatedKey").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string fileIdHex = info[0].As<Napi::String>().Utf8Value();
    std::string keyHex = info[1].As<Napi::String>().Utf8Value();

    if (fileIdHex.length() != 40 || keyHex.length() != 32) {
        Napi::RangeError::New(env, "fileId must be 40 hex chars (20 bytes), key must be 32 hex chars (16 bytes)").ThrowAsJavaScriptException();
        return env.Null();
    }

    uint8_t file_id[20] = {0};
    uint8_t key[16] = {0};
    uint8_t decrypted_key[16] = {0};
    uint8_t bound_key[16] = {0};

    hex2bin_napi(fileIdHex, file_id, 20);
    hex2bin_napi(keyHex, key, 16);

    decrypt_main(key, decrypted_key);
    bind_key(decrypted_key, file_id, bound_key);

    std::string result = bin2hex(bound_key, 16);
    return Napi::String::New(env, result);
}

// Init
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "deobfuscateKey"), Napi::Function::New(env, DeobfuscateKey));
    return exports;
}

NODE_API_MODULE(unplayplay_native, Init)
