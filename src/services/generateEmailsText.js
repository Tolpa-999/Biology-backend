export const verifyEmailBody = (verificationCode) => {
  return {
    subject: "🔬 فعّل حسابك واكتشف عالم الأحياء!",
    message: `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 620px;
        margin: auto;
        padding: 0;
        background-color: #f0f8ff;
        border-radius: 12px;
        border: 1px solid #cce7ff;
        overflow: hidden;
        color: #333;
        direction: rtl;
      ">
        <!-- Header -->
        <div style="background:#1abc9c; padding:18px; text-align:center; color:#fff; font-size:22px; font-weight:bold;">
          Bioly - منصة تعلم الأحياء
        </div>

        <!-- Body -->
        <div style="padding: 28px; text-align:center;">
          <h2 style="color:#1abc9c; margin:0 0 12px;">👋 أهلاً بك يا عالم الأحياء الصغير!</h2>
          <p style="font-size:15px; color:#444; margin:0 0 18px;">
            لتبدأ رحلتك الممتعة في عالم الخلايا والجينات والكائنات الحية، فقط أدخل كود التحقق التالي:
          </p>

          <div style="
            display:inline-block;
            background:#1abc9c;
            color:#fff;
            font-size:28px;
            font-weight:bold;
            letter-spacing:6px;
            padding:14px 32px;
            border-radius:8px;
            margin:20px 0;
          ">
            ${verificationCode}
          </div>

          <p style="font-size:14px; color:#d35400; margin:12px 0;">
            الكود صالح لمدة <strong>٢ دقيقة</strong> ⏳
          </p>

          <p style="font-size:13px; color:#666; margin-top:25px;">
            إذا لم تقم بالتسجيل، لا تقلق! يمكنك تجاهل هذه الرسالة. 🧬
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#e6f7f1; padding:15px; text-align:center; font-size:12px; color:#777;">
          استمتع بالتعلم! 💚 فريق Bioly <br/>
          © 2025 Bioly - جميع الحقوق محفوظة.
        </div>
      </div>
    `
  };
};


// 📩 Email Template: Reset Password
export const resetPasswordEmailBody = (resetCode, userEmail) => {
  return {
    subject: "🔑 إعادة تعيين كلمة المرور - Bioly",
    message: `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 620px;
        margin: auto;
        padding: 0;
        background-color: #fff3e6;
        border-radius: 12px;
        border: 1px solid #ffd9b3;
        overflow: hidden;
        color: #333;
        direction: rtl;
      ">
        <!-- Header -->
        <div style="background:#f39c12; padding:18px; text-align:center; color:#fff; font-size:22px; font-weight:bold;">
          Bioly - استعادة الوصول
        </div>

        <!-- Body -->
        <div style="padding:28px; text-align:center;">
          <h2 style="color:#f39c12; margin:0 0 12px;">🧬 نسيت كلمة المرور؟ لا تقلق!</h2>
          <p style="font-size:15px; color:#444; margin:0 0 18px;">
            لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحساب البريد:<br/>
            <strong>${userEmail}</strong><br/>
            استخدم الكود التالي للعودة لمغامرتك العلمية:
          </p>

          <div style="
            display:inline-block;
            background:#f39c12;
            color:#fff;
            font-size:26px;
            font-weight:bold;
            letter-spacing:5px;
            padding:14px 32px;
            border-radius:8px;
            margin:20px 0;
          ">
            ${resetCode}
          </div>

          <p style="font-size:14px; color:#d35400; margin:12px 0;">
            الكود صالح لمدة <strong>٥ دقائق</strong> ⏳
          </p>

          <p style="font-size:13px; color:#666; margin-top:25px;">
            إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان. 🧪
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#fff0e6; padding:15px; text-align:center; font-size:12px; color:#777;">
          استمتع بالتعلم! 💛 فريق Bioly <br/>
          © 2025 Bioly - جميع الحقوق محفوظة.
        </div>
      </div>
    `
  };
};
