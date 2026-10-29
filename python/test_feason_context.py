import io
import json
import unittest
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from feason_context import FeasonContextClient, FeasonContextError


class FakeResponse:
    status = 200

    def __init__(self, body=None):
        self.body = body if body is not None else json.dumps({
            "corpusVersion": "theology-v7.0.0", "sourceCount": 38
        }).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return self.body


class ClientTest(unittest.TestCase):
    @patch("feason_context.urlopen", return_value=FakeResponse())
    def test_manifest_uses_bearer_auth(self, mocked_urlopen):
        client = FeasonContextClient("token", "https://example.test/")
        self.assertEqual(client.manifest()["corpusVersion"], "theology-v7.0.0")
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/api/context/v1/manifest")
        self.assertEqual(request.get_header("Authorization"), "Bearer token")

    @patch("feason_context.urlopen", return_value=FakeResponse())
    def test_contextualize_sends_prompt_budget(self, mocked_urlopen):
        client = FeasonContextClient("token", "https://example.test/")
        client.contextualize("What is grace?", max_tokens=1500)
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/api/context/v1/contextualize")
        self.assertEqual(json.loads(request.data), {
            "query": "What is grace?", "traditions": [], "maxTokens": 1500, "maxSources": 12
        })

    @patch("feason_context.urlopen", return_value=FakeResponse())
    def test_evaluate_claim_sends_stance_limit(self, mocked_urlopen):
        client = FeasonContextClient("token", "https://example.test/")
        client.evaluate_claim("Baptism always saves.", limit_per_stance=3)
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/api/context/v1/evaluate-claim")
        self.assertEqual(json.loads(request.data), {
            "claim": "Baptism always saves.", "limitPerStance": 3
        })

    @patch("feason_context.urlopen", return_value=FakeResponse())
    def test_claim_proof_sends_bounded_request(self, mocked_urlopen):
        client = FeasonContextClient("token", "https://example.test/")
        client.claim_proof("The Son is fully divine", limit_per_stance=4)
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/api/context/v1/claim-proof")
        self.assertEqual(json.loads(request.data), {
            "claim": "The Son is fully divine", "limitPerStance": 4
        })

    def test_http_errors_preserve_status_and_json_payload(self):
        payload = {"error": "Rate limited", "retryAfter": 60}
        error = HTTPError("https://example.test", 429, "Too many requests", {},
                          io.BytesIO(json.dumps(payload).encode()))
        with patch("feason_context.urlopen", side_effect=error):
            with self.assertRaises(FeasonContextError) as raised:
                FeasonContextClient("secret").manifest()
        self.assertEqual(raised.exception.status, 429)
        self.assertEqual(raised.exception.payload, payload)
        self.assertNotIn("secret", str(raised.exception))

    def test_non_json_http_errors_use_generic_payload(self):
        for body in (b"<html>private upstream diagnostic</html>", b"", b"\xff\xfe"):
            with self.subTest(body=body):
                error = HTTPError("https://example.test", 502, "Bad gateway", {}, io.BytesIO(body))
                with patch("feason_context.urlopen", side_effect=error):
                    with self.assertRaises(FeasonContextError) as raised:
                        FeasonContextClient("token").manifest()
                self.assertEqual(raised.exception.status, 502)
                self.assertEqual(raised.exception.payload, {
                    "error": "The server returned a non-JSON error response"
                })

    def test_malformed_successful_responses_use_typed_errors(self):
        for body in (b"<html>private upstream diagnostic</html>", b"", b"{", b"\xff\xfe"):
            with self.subTest(body=body):
                with patch("feason_context.urlopen", return_value=FakeResponse(body)):
                    with self.assertRaises(FeasonContextError) as raised:
                        FeasonContextClient("token").manifest()
                self.assertEqual(raised.exception.status, 200)
                self.assertEqual(raised.exception.payload, {
                    "error": "The server returned an invalid JSON response"
                })

    def test_successful_responses_require_json_objects(self):
        for body in (b"null", b"[]", b'"private upstream diagnostic"', b"true", b"42"):
            with self.subTest(body=body):
                with patch("feason_context.urlopen", return_value=FakeResponse(body)):
                    with self.assertRaises(FeasonContextError) as raised:
                        FeasonContextClient("token").manifest()
                self.assertEqual(raised.exception.status, 200)
                self.assertEqual(raised.exception.payload, {
                    "error": "The server returned a non-object JSON response"
                })

    def test_network_errors_remain_transport_errors(self):
        error = URLError("Synthetic connection failure")
        with patch("feason_context.urlopen", side_effect=error):
            with self.assertRaises(URLError) as raised:
                FeasonContextClient("token").manifest()
        self.assertIs(raised.exception, error)


if __name__ == "__main__":
    unittest.main()
