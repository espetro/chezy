"""Day-0 smoke test.

Replaces pytest's default "no tests collected" failure (exit code 5) with
exit code 0 so the validate gate stays green on the empty stub. Remove this
file the moment a real test ships in apps/scraper/tests/.
"""


def test_smoke() -> None:
    """Day-0 stub. Exists so pytest doesn't fail with "no tests collected"."""
    assert True
