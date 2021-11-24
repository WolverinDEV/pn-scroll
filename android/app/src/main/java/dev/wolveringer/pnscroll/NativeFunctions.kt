package dev.wolveringer.pnscroll

import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
//import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.network.OkHttpClientProvider
import dev.wolveringer.pnscroll.util.PerformanceInfo
import okhttp3.*
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.*
import java.util.concurrent.LinkedBlockingDeque
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

class NativeFunctions constructor(context: ReactApplicationContext?) : ReactContextBaseJavaModule(context) {
    private val httpClient: OkHttpClient = run {
        OkHttpClientProvider.getOkHttpClient()
            .newBuilder()
            .cookieJar(CookieJar.NO_COOKIES)
            .cache(null)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val executor: ThreadPoolExecutor = run {
        ThreadPoolExecutor(1, 6, 60L, TimeUnit.SECONDS, LinkedBlockingDeque())
    }

    override fun getName(): String {
        return "PNScrollNativeFunctions"
    }

    @RequiresApi(Build.VERSION_CODES.P)
    @ReactMethod
    fun toggleFullScreen(enabled: Boolean) {
        UiThreadUtil.runOnUiThread {
            val window = currentActivity?.window

            if(window == null) {
                Log.w("NativeFunctions", "Can not toggle full screen since we're missing the window");
                return@runOnUiThread
            }

            //WindowCompat.setDecorFitsSystemWindows(window, !enabled);
            //val controller = WindowInsetsControllerCompat(window, window.decorView);
            //if(enabled) {
            //    controller.hide(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            //    controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE;
            //} else {
            //    controller.show(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout());
            //}
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    @ReactMethod
    fun downloadImage(url: String, headers: ReadableMap, promise: Promise) {
        val performance = PerformanceInfo()

        val callbackFailure = { message: String ->
            val result: WritableMap = WritableNativeMap()
            result.putString("status", "failure")
            result.putString("message", message)
            promise.resolve(result)
        }

        val callbackSuccess = { file: Path ->
            val result: WritableMap = WritableNativeMap()
            result.putString("status", "success")
            result.putString("uri", file.toUri().toString())
            promise.resolve(result)
        }

        val fileName = try {
            urlToFileName(url)
        } catch(e: Exception) {
            callbackFailure("failed to generate file name")
            return
        }

        val targetFile = Paths.get(
            this.reactApplicationContext.cacheDir.toString(),
            "image-cache",
            fileName.substring(0, 2),
            urlToFileName(url)
        ).toFile()

        if (targetFile.exists()) {
            Log.d("ImageDownload", "[$fileName] Target image already exists (" + targetFile.path + "). Using it.")
            callbackSuccess(targetFile.toPath())
            return
        }

        Log.d("ImageDownload", "[$fileName] Scheduled download for $url")
        this.executor.execute {
            val requestBuilder = Request.Builder()
            requestBuilder.get()
            requestBuilder.url(url)
            run {
                val headerIterator = headers.keySetIterator()
                while (headerIterator.hasNextKey()) {
                    val key = headerIterator.nextKey()
                    val value = headers.getString(key) ?: continue
                    requestBuilder.addHeader(key, value)
                }
            }

            performance.mark("execute request")
            val response = try {
                httpClient.newCall(requestBuilder.build()).execute()
            } catch(e: Exception) {
                Log.w("ImageDownload", "Download failed: ", e)
                callbackFailure("download exception: " + e.message)
                promise.reject(e)
                return@execute
            }

            performance.mark("handle response")

            if (response.code != 200) {
                callbackFailure(response.code.toString() + "/" + response.message)
                response.close()
                return@execute
            }

            val body = response.body
            if (body == null) {
                callbackFailure("missing body")
                response.close()
                return@execute
            }

            val contentType = response.header("content-type")
            if (contentType == null) {
                callbackFailure("missing content-type header")
                response.close()
                return@execute
            }

            performance.mark("schedule write")
            try {
                performance.mark("write start")
                if(targetFile.exists()) {
                    targetFile.delete()
                } else {
                    Files.createDirectories(targetFile.toPath())
                }
                Files.copy(
                    body.byteStream(),
                    targetFile.toPath(),
                    StandardCopyOption.REPLACE_EXISTING
                )
            } catch (e: IOException) {
                Log.w("ImageDownload", "[$fileName] Failed to save file", e)
                callbackFailure("Failed to save file: " + e.message)
                return@execute
            } finally {
                response.close()
            }


            callbackSuccess(targetFile.toPath())

            val pReport = performance.finish("finish")
            Log.d(
                "ImageDownload",
                "[$fileName] Image of type $contentType downloaded in " + pReport.time() + "ms:\n" + pReport.info()
            )
        }
    }

    @Throws(Exception::class)
    private fun urlToFileName(url: String): String {
        return MessageDigest.getInstance("SHA-1")
            .digest(url.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02X".format(it) }
    }
}