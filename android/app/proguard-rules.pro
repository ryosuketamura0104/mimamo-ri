# mimamo-ri release ビルド用 ProGuard/R8 ルール

# kotlinx-serialization: @Serializable クラスと生成シリアライザを保持
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keep,includedescriptorclasses class com.crouton.mimamori.**$$serializer { *; }
-keepclassmembers class com.crouton.mimamori.** {
    *** Companion;
}
-keepclasseswithmembers class com.crouton.mimamori.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Ktor (OkHttp エンジン): 参照のみで実体を持たない管理系クラスの警告を抑止
-dontwarn io.ktor.**
-dontwarn org.slf4j.**
-dontwarn java.lang.management.**
