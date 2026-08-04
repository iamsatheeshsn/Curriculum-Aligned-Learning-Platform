<?php

/**
 * Shared HTTP helpers for the Control-portal QA harness (test-only).
 */

const QA_API = 'http://127.0.0.1:8000/api/v1';

function qa(string $method, string $path, ?string $token = null, $body = null): array
{
    $ch = curl_init(str_starts_with($path, 'http') ? $path : QA_API.$path);
    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if ($token) {
        $headers[] = "Authorization: Bearer {$token}";
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => (string) $raw,
        'json' => json_decode((string) $raw, true),
        'curl_error' => $err,
    ];
}

function qa_login(string $email, string $password): ?string
{
    $res = qa('POST', '/auth/admin/login', null, ['email' => $email, 'password' => $password]);

    return qa_dg($res['json'], 'data.token');
}

function qa_dg($data, string $path, $default = null)
{
    foreach (explode('.', $path) as $seg) {
        if (is_array($data) && array_key_exists($seg, $data)) {
            $data = $data[$seg];
        } else {
            return $default;
        }
    }

    return $data;
}

function qa_msg(array $res, int $len = 300): string
{
    $j = $res['json'];
    if (is_array($j)) {
        $out = (string) ($j['message'] ?? '');
        if (! empty($j['errors'])) {
            $out .= ' | '.json_encode($j['errors']);
        }
        if (trim($out) === '' || trim($out) === '|') {
            $out = (string) json_encode($j);
        }

        return substr(str_replace("\n", ' ', $out), 0, $len);
    }

    return substr(str_replace("\n", ' ', strip_tags($res['body'])), 0, $len);
}
