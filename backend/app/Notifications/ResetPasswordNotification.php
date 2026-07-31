<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordBase;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPasswordBase
{
    public function toMail($notifiable): MailMessage
    {
        $locale = $notifiable->locale ?? app()->getLocale();
        $url = config('app.frontend_url', config('app.url'))
            .'/reset-password?token='.$this->token
            .'&email='.urlencode($notifiable->getEmailForPasswordReset());

        if ($locale === 'ar') {
            return (new MailMessage)
                ->subject('إعادة تعيين كلمة المرور')
                ->line('تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.')
                ->action('إعادة تعيين كلمة المرور', $url)
                ->line('إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.');
        }

        return (new MailMessage)
            ->subject('Reset Password')
            ->line('You are receiving this email because we received a password reset request for your account.')
            ->action('Reset Password', $url)
            ->line('If you did not request a password reset, no further action is required.');
    }
}
