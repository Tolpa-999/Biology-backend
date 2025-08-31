// 📩 Email Template: Verify Email
export const verifyEmailBody = (verificationCode) => {
  return {
    subject: "تأكيد البريد الإلكتروني - UR-DOC",
    message: `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 620px;
        margin: auto;
        padding: 0;
        background-color: #f9f9f9;
        border-radius: 12px;
        border: 1px solid #e6e6e6;
        overflow: hidden;
        color: #333;
        direction: rtl;
      ">
        <!-- Header -->
        <div style="background:#2a9d8f; padding:18px; text-align:center; color:#fff; font-size:20px; font-weight:bold;">
          منصة UR-DOC
        </div>

        <!-- Body -->
        <div style="padding: 28px; text-align:center;">
          <h2 style="color:#2a9d8f; margin:0 0 12px;">👨‍⚕️ أهلاً بك في UR-DOC</h2>
          <p style="font-size:15px; color:#444; margin:0 0 18px;">
            لتفعيل حسابك والاستفادة من كل خدماتنا الطبية، يرجى إدخال كود التحقق التالي:
          </p>

          <div style="
            display:inline-block;
            background:#2a9d8f;
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
            إذا لم تقم بالتسجيل في منصتنا، يمكنك تجاهل هذه الرسالة.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f1f1f1; padding:15px; text-align:center; font-size:12px; color:#777;">
          مع تحيات فريق UR-DOC ❤️ <br/>
          © 2025 UR-DOC - جميع الحقوق محفوظة.
        </div>
      </div>
    `
  };
};


// 📩 Email Template: Reset Password
export const resetPasswordEmailBody = (resetCode, userEmail) => {
  return {
    subject: "إعادة تعيين كلمة المرور - UR-DOC",
    message: `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 620px;
        margin: auto;
        padding: 0;
        background-color: #f9f9f9;
        border-radius: 12px;
        border: 1px solid #e6e6e6;
        overflow: hidden;
        color: #333;
        direction: rtl;
      ">
        <!-- Header -->
        <div style="background:#e63946; padding:18px; text-align:center; color:#fff; font-size:20px; font-weight:bold;">
          UR-DOC - استعادة الوصول
        </div>

        <!-- Body -->
        <div style="padding:28px; text-align:center;">
          <h2 style="color:#e63946; margin:0 0 12px;">🔑 إعادة تعيين كلمة المرور</h2>
          <p style="font-size:15px; color:#444; margin:0 0 18px;">
            تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بالبريد:<br/>
            <strong>${userEmail}</strong><br/>
            برجاء استخدام الكود التالي:
          </p>

          <div style="
            display:inline-block;
            background:#e63946;
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
            إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة بأمان.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f1f1f1; padding:15px; text-align:center; font-size:12px; color:#777;">
          مع خالص التحية 💙 فريق UR-DOC <br/>
          © 2025 UR-DOC - جميع الحقوق محفوظة.
        </div>
      </div>
    `
  };
};
