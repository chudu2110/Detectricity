from app.modules.copilot.services import grounding as g

BILL = {"kwh": 262.2, "amount_vnd_with_vat": 647018, "data_coverage": 0.9, "current_tier": 3}
WEEK = {"period": "week", "kwh_current": 30.0, "kwh_previous": 24.0, "days": 7}


def test_numbers_are_read_the_vietnamese_and_the_english_way():
    assert g.parse_number("647.018") == (647018, 0)
    assert g.parse_number("1,5") == (1.5, 1)
    assert g.parse_number("1.234,5") == (1234.5, 1)
    assert g.parse_number("1,234.5") == (1234.5, 1)
    assert g.parse_number("0.125") == (0.125, 3)
    assert g.parse_number("12") == (12, 0)


def test_figures_carry_their_unit_and_scale():
    found = g.figures("Kỳ này 262,2 kWh [1], khoảng 647.018 đ [2]; 1,2 triệu đồng; 1,5 kW; 90%.")
    assert [(f.value, f.kind) for f in found] == [
        (262.2, "kwh"),
        (647018, "money"),
        (1_200_000, "money"),
        (1500, "w"),
        (90, "ratio"),
    ]
    assert g.figures("Ngày 20/11, bậc 3, 7 ngày") == []  # bare numbers are not figures


def test_backed_figures_pass_within_rounding():
    text = "Kỳ này bạn dùng 262 kWh [1], khoảng 650.000 đ [1], dữ liệu đủ 90% [1]."
    assert g.check(text, [BILL]).ok


def test_a_figure_no_tool_gave_is_flagged():
    v = g.check("Bạn sẽ tiết kiệm 120.000 đ mỗi tháng.", [BILL])
    assert v.problems == ["120.000 đ mỗi tháng"]


def test_a_figure_of_the_wrong_unit_is_flagged():
    assert g.check("Kỳ này 647.018 kWh.", [BILL]).problems == ["647.018 kWh"]


def test_differences_and_percent_changes_of_tool_figures_are_backed():
    text = "Tuần này tăng 6 kWh [1], tức 25% so với tuần trước."
    assert g.check(text, [WEEK], {"week"}).ok


def test_a_comparison_over_the_wrong_period_is_flagged():
    v = g.check("So với tháng trước tăng 6 kWh.", [WEEK], {"week"})
    assert v.figures == 1 and len(v.problems) == 1  # the figure is fine, the period is not


def test_unbacked_sentences_are_dropped():
    text = "Kỳ này 262 kWh [1]. Bạn tiết kiệm 120.000 đ. Hãy tắt máy lạnh."
    assert g.drop_sentences(text, ["120.000 đ"]) == "Kỳ này 262 kWh [1]. Hãy tắt máy lạnh."


def test_a_monthly_figure_quoted_per_day_is_flagged():
    standby = {"typical_watts": 126, "kwh_per_month": 90.4}
    assert g.check("Điện nền tốn 90 kWh mỗi tháng [1].", [standby]).ok
    assert g.check("Điện nền tốn 90 kWh mỗi ngày [1].", [standby]).problems == ["90 kWh mỗi ngày"]


def test_hours_are_checked_but_times_of_day_are_not():
    basis = {"hours_per_day_cut": 1.5, "hours_per_day_measured": 3.1, "watts_when_on": 256}
    assert g.check("Bớt 1,5 giờ mỗi ngày trên 3,1 giờ đang chạy, ở 256 W.", [basis]).ok
    assert g.check("Bớt 5 giờ mỗi ngày.", [basis]).problems == ["5 giờ mỗi ngày"]
    assert g.figures("Từ 0h đến 5h sáng, lúc 7 giờ tối") == []


def test_the_gate_shows_checked_sentences_and_holds_from_the_first_bad_one():
    gate = g.Gate(lambda s: g.check(s, [BILL]))
    shown = gate.feed("Kỳ này 262 kWh [1]. Bạn tiết")
    shown += gate.feed(" kiệm 120.000 đ. Hãy tắt máy lạnh. ")
    assert shown == "Kỳ này 262 kWh [1]. "
    assert gate.held and gate.close() == ""
