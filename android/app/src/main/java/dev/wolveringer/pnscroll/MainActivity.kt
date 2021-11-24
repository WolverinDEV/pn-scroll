package dev.wolveringer.pnscroll

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.annotation.CallSuper
import androidx.annotation.MainThread
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String {
        return "pn-scroll"
    }

    @MainThread
    @CallSuper
    override fun onCreate(savedInstanceState: Bundle?) {
        /* https://dev.to/brunolemos/adding-notch-support-to-your-react-native-android-app-3ci3 */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val layoutParams = WindowManager.LayoutParams()
            layoutParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = layoutParams

            /* The suggested methods do not wor. We keep using these flags. */
            window.addFlags(
                WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
            )
        }

        super.onCreate(savedInstanceState)
    }
}