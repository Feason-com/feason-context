import json
import unittest
from unittest.mock import patch

from feason_context import FeasonContextClient


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return json.dumps({"corpusVersion": "theology-v7.0.0", "sourceCount": 38}).encode()


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


if __name__ == "__main__":
    unittest.main()
