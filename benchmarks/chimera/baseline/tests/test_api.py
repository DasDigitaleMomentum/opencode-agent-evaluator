from gateway.rest_api import post_order

def test_api_unauthorized():
    res = post_order("wrong", {})
    assert res['status'] == 401