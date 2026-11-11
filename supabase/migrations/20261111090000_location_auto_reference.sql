-- Automatic map points for places without a verified point, part 1: reference
-- data, matching rules and the plan (dry run). Nothing here changes an event.
--
-- 1. Address register: the one street address of the event text that lies in the
--    event's municipality and in the town or parish the text names.
-- 2. Known institutions: "Latvijas kultūras institūcijas" (data.gov.lv, source
--    kulturasdati.lv), matched by name within the municipality.
-- 3. A bare town, village or parish name: its official centre (VZD "Vietu centroidi").
-- 4. An address found on the event's source page, looked up in the address register.
-- Coordinates only ever come from these three tables. A point outside Latvia,
-- two different answers for one place or any doubt leaves the place to the admin.

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
create table if not exists meets_private.country_borders(
  country_code text primary key,
  geom extensions.geometry not null,
  source text not null,
  updated_at timestamptz not null default now()
);
revoke all on meets_private.country_borders from public,anon,authenticated;

-- Latvia: the union of all municipalities and towns of the State Address Register
-- spatial data (aw_shp.zip, 11.2026), widened by 300 m and simplified to 200 m.
insert into meets_private.country_borders(country_code,geom,source)
values('LV',extensions.st_multi(extensions.st_geomfromtext('MULTIPOLYGON (((20.9668 56.3438, 20.9679 56.3716, 20.9901 56.4315, 20.9945 56.4688, 20.9836 56.5087, 20.9781 56.5190, 20.9637 56.5247, 20.9572 56.5491, 20.9668 56.5561, 20.9957 56.5598, 21.0344 56.6360, 21.0464 56.6719, 21.0547 56.7312, 21.0470 56.8212, 21.0512 56.8343, 21.0622 56.8450, 21.1551 56.8863, 21.1633 56.8940, 21.1824 56.8958, 21.2396 56.9193, 21.2622 56.9336, 21.2858 56.9558, 21.3002 56.9597, 21.3450 56.9837, 21.3691 57.0026, 21.4043 57.0495, 21.4124 57.0794, 21.4016 57.1750, 21.4094 57.2130, 21.4068 57.2689, 21.4145 57.2918, 21.4216 57.3017, 21.4484 57.3181, 21.5025 57.3680, 21.5236 57.3929, 21.5193 57.4052, 21.5228 57.4096, 21.5346 57.4110, 21.5496 57.4077, 21.5889 57.4311, 21.6317 57.4859, 21.6569 57.5072, 21.6838 57.5578, 21.7083 57.5753, 21.7297 57.5822, 21.8429 57.6007, 21.9641 57.6036, 22.0102 57.6096, 22.0805 57.6271, 22.1571 57.6510, 22.5011 57.7451, 22.5597 57.7575, 22.6072 57.7613, 22.6087 57.7557, 22.5831 57.7157, 22.5790 57.6818, 22.5918 57.6411, 22.6189 57.6048, 22.6447 57.5834, 22.6987 57.5521, 22.8049 57.5127, 22.8150 57.5133, 22.8191 57.5055, 22.8505 57.4938, 22.8912 57.4595, 22.9068 57.4536, 22.9171 57.4350, 22.9431 57.4188, 23.0128 57.3964, 23.0374 57.3815, 23.0895 57.3703, 23.1234 57.3695, 23.1369 57.3613, 23.1345 57.3445, 23.1470 57.3354, 23.1428 57.3263, 23.1660 57.3032, 23.1729 57.2751, 23.1848 57.2644, 23.1802 57.2486, 23.1830 57.2354, 23.2047 57.2124, 23.2315 57.1721, 23.2434 57.1647, 23.2363 57.1578, 23.2349 57.1393, 23.2417 57.1104, 23.2720 57.0852, 23.3070 57.0668, 23.3641 57.0487, 23.4252 57.0396, 23.4897 57.0370, 23.5105 57.0198, 23.5290 56.9964, 23.5628 56.9789, 23.5971 56.9753, 23.6204 56.9680, 23.6499 56.9654, 23.6987 56.9672, 23.7636 56.9741, 23.8561 56.9910, 23.9269 57.0098, 23.9726 57.0276, 23.9984 57.0434, 24.0161 57.0585, 24.0053 57.0648, 24.0119 57.0707, 24.0297 57.0676, 24.0821 57.0783, 24.1695 57.1088, 24.2097 57.1280, 24.2557 57.1590, 24.3377 57.1988, 24.3757 57.2263, 24.3962 57.2490, 24.4053 57.2666, 24.4074 57.2834, 24.4035 57.3114, 24.3946 57.3165, 24.3988 57.3204, 24.3998 57.3410, 24.3942 57.3976, 24.3797 57.4492, 24.3751 57.5120, 24.3685 57.5298, 24.3571 57.5412, 24.3642 57.5581, 24.3581 57.5776, 24.3675 57.6011, 24.3813 57.6165, 24.3624 57.6484, 24.3591 57.6737, 24.3377 57.7024, 24.3412 57.7467, 24.3343 57.7554, 24.3438 57.7588, 24.3376 57.7885, 24.3422 57.7920, 24.3279 57.8282, 24.3396 57.8537, 24.3391 57.8652, 24.3464 57.8720, 24.3449 57.8783, 24.4107 57.8743, 24.4152 57.8689, 24.4542 57.8815, 24.4474 57.8994, 24.4519 57.9046, 24.4405 57.9083, 24.4583 57.9266, 24.5061 57.9327, 24.5052 57.9360, 24.5139 57.9387, 24.5165 57.9450, 24.5287 57.9493, 24.5408 57.9481, 24.5461 57.9521, 24.5701 57.9566, 24.5851 57.9647, 24.6266 57.9449, 24.6382 57.9522, 24.6433 57.9618, 24.6767 57.9617, 24.6918 57.9507, 24.7125 57.9648, 24.7383 57.9666, 24.7391 57.9842, 24.8076 57.9932, 24.8332 57.9760, 24.8468 57.9785, 24.9466 58.0118, 24.9934 58.0136, 25.0168 58.0199, 25.0729 58.0680, 25.0999 58.0689, 25.1032 58.0801, 25.1345 58.0825, 25.1569 58.0775, 25.1851 58.0785, 25.1853 58.0815, 25.1997 58.0883, 25.2161 58.0825, 25.2215 58.0747, 25.2100 58.0650, 25.2204 58.0612, 25.2218 58.0559, 25.2332 58.0541, 25.2222 58.0403, 25.2249 58.0297, 25.2490 58.0225, 25.2497 58.0168, 25.2371 58.0152, 25.2482 58.0061, 25.2602 58.0045, 25.2613 57.9969, 25.2835 57.9932, 25.2922 57.9957, 25.2910 58.0008, 25.2965 58.0026, 25.2921 58.0147, 25.2986 58.0338, 25.2896 58.0444, 25.2760 58.0488, 25.2598 58.0601, 25.2615 58.0685, 25.2769 58.0721, 25.2830 58.0834, 25.2968 58.0841, 25.3401 58.0589, 25.3678 58.0333, 25.4099 58.0317, 25.4523 58.0189, 25.4719 58.0049, 25.4503 57.9962, 25.4820 57.9845, 25.4879 57.9780, 25.5211 57.9828, 25.5278 57.9745, 25.5532 57.9749, 25.5604 57.9678, 25.5726 57.9765, 25.5837 57.9740, 25.5994 57.9597, 25.5886 57.9453, 25.6419 57.9328, 25.6548 57.9179, 25.6807 57.9146, 25.6837 57.9069, 25.7013 57.9061, 25.7164 57.9145, 25.7233 57.9239, 25.7390 57.9267, 25.7923 57.9062, 25.7906 57.8995, 25.8237 57.8671, 25.8577 57.8602, 25.8776 57.8675, 25.8920 57.8526, 25.9318 57.8561, 25.9617 57.8489, 25.9987 57.8617, 26.0142 57.8603, 26.0232 57.8499, 26.0360 57.8530, 26.0596 57.8506, 26.0637 57.8366, 26.0436 57.8094, 26.0378 57.7890, 26.0309 57.7835, 26.0321 57.7742, 26.0478 57.7697, 26.0538 57.7643, 26.0687 57.7695, 26.0801 57.7694, 26.1387 57.7533, 26.1466 57.7457, 26.1427 57.7401, 26.1471 57.7354, 26.1763 57.7315, 26.2099 57.7165, 26.1861 57.6884, 26.1977 57.6878, 26.2157 57.6813, 26.2187 57.6667, 26.2439 57.6596, 26.2481 57.6512, 26.2439 57.6481, 26.2526 57.6358, 26.2487 57.6322, 26.2583 57.6273, 26.2614 57.6158, 26.2713 57.6104, 26.2790 57.5996, 26.2899 57.5941, 26.3134 57.5952, 26.3215 57.5867, 26.3317 57.5836, 26.3459 57.5867, 26.4023 57.5750, 26.4719 57.5779, 26.4956 57.5464, 26.5043 57.5262, 26.5266 57.5188, 26.5559 57.5168, 26.5598 57.5198, 26.5571 57.5297, 26.5854 57.5426, 26.5937 57.5374, 26.5966 57.5184, 26.6113 57.5142, 26.6103 57.5307, 26.6385 57.5483, 26.6438 57.5561, 26.6662 57.5562, 26.6649 57.5638, 26.6729 57.5688, 26.6913 57.5689, 26.6964 57.5735, 26.7100 57.5693, 26.7220 57.5749, 26.7294 57.5734, 26.7242 57.5810, 26.7367 57.5903, 26.7577 57.5802, 26.7753 57.5772, 26.7774 57.5832, 26.7855 57.5828, 26.7898 57.5784, 26.7930 57.5835, 26.8031 57.5864, 26.8320 57.5854, 26.8437 57.5916, 26.8569 57.5940, 26.8528 57.6111, 26.8607 57.6175, 26.8832 57.6237, 26.9068 57.6358, 26.9285 57.6357, 26.9346 57.6263, 26.9420 57.6227, 26.9544 57.6222, 26.9561 57.6149, 26.9459 57.6086, 26.9482 57.6060, 26.9584 57.6090, 26.9669 57.6080, 26.9753 57.6153, 26.9953 57.6131, 26.9993 57.6073, 27.0335 57.6070, 27.0494 57.5975, 27.0448 57.5856, 27.0696 57.5839, 27.0773 57.5795, 27.0898 57.5791, 27.1057 57.5685, 27.1201 57.5647, 27.1630 57.5631, 27.1950 57.5535, 27.2257 57.5574, 27.2483 57.5515, 27.2597 57.5533, 27.2788 57.5459, 27.2836 57.5406, 27.2994 57.5422, 27.3284 57.5260, 27.3523 57.5223, 27.3619 57.5274, 27.3656 57.5353, 27.3743 57.5381, 27.3834 57.5377, 27.3997 57.5280, 27.4161 57.5257, 27.4420 57.5342, 27.4642 57.5331, 27.4671 57.5372, 27.4862 57.5381, 27.4999 57.5429, 27.5602 57.5396, 27.5547 57.5243, 27.5708 57.5162, 27.5723 57.5089, 27.5607 57.4971, 27.5557 57.4652, 27.5439 57.4644, 27.5232 57.4281, 27.5299 57.4282, 27.5632 57.4147, 27.5923 57.4197, 27.6050 57.4181, 27.6267 57.4040, 27.6730 57.3973, 27.6884 57.3741, 27.7596 57.3568, 27.7627 57.3524, 27.7828 57.3452, 27.7847 57.3352, 27.7784 57.3311, 27.7849 57.3229, 27.8138 57.3268, 27.8264 57.3253, 27.8475 57.3120, 27.8515 57.3055, 27.8585 57.3054, 27.8707 57.2981, 27.8727 57.2918, 27.8657 57.2645, 27.8710 57.2620, 27.8753 57.2479, 27.8702 57.2428, 27.8623 57.2417, 27.8582 57.2339, 27.8483 57.2281, 27.8433 57.2197, 27.8472 57.2114, 27.8326 57.2017, 27.8357 57.1990, 27.8310 57.1921, 27.8399 57.1821, 27.8324 57.1723, 27.8382 57.1664, 27.8273 57.1573, 27.8229 57.1424, 27.7898 57.1303, 27.7604 57.1284, 27.7593 57.1218, 27.7414 57.1171, 27.7393 57.1142, 27.7578 57.1083, 27.7549 57.0961, 27.7484 57.0954, 27.7384 57.0992, 27.7206 57.0977, 27.7255 57.0945, 27.7454 57.0920, 27.7539 57.0872, 27.7662 57.0893, 27.7737 57.0855, 27.7482 57.0672, 27.7536 57.0529, 27.7335 57.0373, 27.7333 57.0265, 27.7201 57.0070, 27.7322 57.0041, 27.7700 57.0079, 27.7745 57.0050, 27.7472 56.9561, 27.7416 56.9189, 27.7157 56.9105, 27.6910 56.9121, 27.6765 56.8944, 27.6753 56.8692, 27.6604 56.8527, 27.6641 56.8384, 27.6888 56.8395, 27.6976 56.8429, 27.7003 56.8495, 27.7151 56.8505, 27.7307 56.8597, 27.7419 56.8582, 27.7641 56.8653, 27.7892 56.8674, 27.7959 56.8655, 27.8179 56.8693, 27.8484 56.8821, 27.8782 56.8788, 27.8804 56.8737, 27.8757 56.8674, 27.8886 56.8586, 27.9031 56.8390, 27.9067 56.8249, 27.9322 56.8288, 27.9634 56.8403, 27.9724 56.8380, 27.9745 56.8282, 27.9812 56.8252, 27.9771 56.8207, 27.9811 56.8106, 27.9668 56.8033, 27.9590 56.8043, 27.9483 56.8012, 27.9457 56.7914, 27.9521 56.7830, 27.9491 56.7754, 27.9352 56.7706, 27.9199 56.7717, 27.9041 56.7532, 27.9180 56.7520, 27.9222 56.7351, 27.9398 56.7300, 27.9513 56.7185, 27.9661 56.7137, 27.9667 56.7100, 27.9844 56.7087, 27.9868 56.7029, 27.9812 56.6932, 27.9984 56.6906, 28.0168 56.6738, 28.0163 56.6373, 28.0440 56.6091, 28.0465 56.5928, 28.0565 56.5880, 28.0768 56.5888, 28.1002 56.5850, 28.1293 56.5846, 28.1482 56.5727, 28.1422 56.5644, 28.1467 56.5516, 28.1385 56.5469, 28.1070 56.5402, 28.1054 56.5305, 28.0983 56.5276, 28.0994 56.5156, 28.1083 56.5114, 28.1269 56.5183, 28.1409 56.5098, 28.1342 56.5024, 28.1346 56.4922, 28.1794 56.4566, 28.1936 56.4537, 28.1973 56.4495, 28.1996 56.4405, 28.1876 56.4260, 28.1909 56.4129, 28.1992 56.4051, 28.1848 56.3966, 28.1691 56.3775, 28.1984 56.3591, 28.2109 56.3236, 28.2350 56.2979, 28.2463 56.2786, 28.2441 56.2702, 28.2220 56.2469, 28.2017 56.2395, 28.1905 56.2301, 28.1915 56.2217, 28.2052 56.2187, 28.2088 56.2143, 28.1998 56.2064, 28.1872 56.2053, 28.1911 56.1954, 28.1827 56.1876, 28.1823 56.1774, 28.1569 56.1674, 28.1398 56.1681, 28.1313 56.1633, 28.1218 56.1626, 28.1072 56.1507, 28.0993 56.1485, 28.0967 56.1347, 28.0716 56.1370, 28.0497 56.1276, 28.0467 56.1163, 28.0243 56.1168, 28.0190 56.1216, 28.0072 56.1239, 27.9758 56.1180, 27.9737 56.1088, 27.9564 56.1014, 27.9435 56.0903, 27.9400 56.0724, 27.9243 56.0581, 27.9142 56.0556, 27.9082 56.0467, 27.9012 56.0449, 27.8901 56.0499, 27.8737 56.0497, 27.8638 56.0416, 27.8408 56.0356, 27.8221 56.0373, 27.8137 56.0346, 27.8332 56.0278, 27.8381 56.0214, 27.8209 56.0061, 27.8152 56.0049, 27.8158 55.9895, 27.8057 55.9842, 27.8052 55.9795, 27.7843 55.9725, 27.7683 55.9725, 27.7558 55.9758, 27.6578 55.9283, 27.6577 55.9122, 27.6298 55.8916, 27.6445 55.8481, 27.6181 55.7848, 27.5904 55.7807, 27.5508 55.7817, 27.4766 55.7878, 27.4673 55.7915, 27.4319 55.7916, 27.3610 55.8101, 27.3523 55.7997, 27.3077 55.7903, 27.2862 55.7825, 27.2465 55.7922, 27.2384 55.8043, 27.2100 55.8193, 27.1969 55.8313, 27.1687 55.8352, 27.1583 55.8463, 27.1513 55.8490, 27.1442 55.8459, 27.1333 55.8486, 27.1190 55.8471, 27.1066 55.8419, 27.1027 55.8281, 27.0959 55.8249, 27.0823 55.8236, 27.0456 55.8275, 27.0324 55.8200, 27.0151 55.8256, 26.9994 55.8162, 26.9771 55.8120, 26.9710 55.8042, 26.9569 55.7965, 26.9497 55.7854, 26.9316 55.7873, 26.9237 55.7853, 26.9044 55.7577, 26.9054 55.7503, 26.8805 55.7338, 26.8832 55.7275, 26.8744 55.7122, 26.8466 55.7044, 26.8296 55.7028, 26.8181 55.6972, 26.8030 55.6956, 26.7863 55.6754, 26.7406 55.6801, 26.7190 55.6983, 26.6535 55.7045, 26.6560 55.6992, 26.6463 55.6944, 26.6400 55.6803, 26.6198 55.6784, 26.5973 55.6720, 26.5743 55.6733, 26.5682 55.6773, 26.5428 55.6740, 26.5196 55.6761, 26.5077 55.6837, 26.4897 55.6860, 26.4853 55.6933, 26.4693 55.6999, 26.4387 55.7068, 26.4174 55.7060, 26.4050 55.7087, 26.3856 55.7018, 26.3726 55.7073, 26.3613 55.7302, 26.3473 55.7400, 26.3110 55.7405, 26.2645 55.7664, 26.2266 55.8117, 26.2306 55.8201, 26.2249 55.8371, 26.2002 55.8571, 26.1832 55.8653, 26.1708 55.8631, 26.1490 55.8742, 26.1167 55.8776, 26.0861 55.8993, 26.0599 55.9285, 26.0507 55.9335, 26.0407 55.9443, 26.0410 55.9528, 26.0106 55.9637, 25.9972 55.9606, 25.9716 55.9789, 25.9440 55.9821, 25.9396 55.9861, 25.8985 55.9945, 25.8919 55.9981, 25.8575 55.9976, 25.8441 56.0081, 25.8547 56.0158, 25.8540 56.0216, 25.8481 56.0279, 25.8381 56.0278, 25.8314 56.0310, 25.8153 56.0529, 25.7587 56.0612, 25.7345 56.0744, 25.6842 56.0847, 25.6812 56.0917, 25.6913 56.0969, 25.6882 56.1041, 25.6942 56.1185, 25.6719 56.1290, 25.6789 56.1431, 25.6740 56.1455, 25.6525 56.1324, 25.6008 56.1318, 25.5621 56.1379, 25.5475 56.1599, 25.5359 56.1625, 25.5130 56.1570, 25.5053 56.1419, 25.4788 56.1402, 25.4514 56.1448, 25.4497 56.1503, 25.4340 56.1515, 25.4196 56.1424, 25.3990 56.1466, 25.3987 56.1549, 25.3530 56.1503, 25.3388 56.1515, 25.3142 56.1422, 25.2763 56.1564, 25.2664 56.1686, 25.2509 56.1714, 25.2443 56.1830, 25.2355 56.1846, 25.2310 56.1893, 25.2179 56.1852, 25.2020 56.1738, 25.1666 56.1712, 25.1481 56.1721, 25.1406 56.1773, 25.1219 56.1821, 25.0966 56.1817, 25.0889 56.1840, 25.0821 56.1929, 25.0710 56.1951, 25.0654 56.2098, 25.0691 56.2186, 25.0582 56.2264, 25.0642 56.2382, 25.0521 56.2439, 25.0566 56.2490, 25.0509 56.2642, 25.0156 56.2751, 25.0090 56.2838, 25.0103 56.2906, 24.9894 56.2964, 24.9837 56.3039, 24.9688 56.3093, 24.9618 56.3434, 24.9649 56.3643, 24.9524 56.3677, 24.9479 56.3732, 24.9381 56.3737, 24.9216 56.3997, 24.9098 56.4022, 24.8973 56.4177, 24.9140 56.4392, 24.9027 56.4444, 24.8881 56.4443, 24.8826 56.4475, 24.8750 56.4471, 24.8582 56.4343, 24.8566 56.4278, 24.8659 56.4233, 24.8681 56.4180, 24.8640 56.4134, 24.8238 56.4080, 24.8186 56.4161, 24.8084 56.4189, 24.8074 56.4101, 24.7770 56.3970, 24.7606 56.4014, 24.7412 56.3978, 24.7050 56.3997, 24.7091 56.3865, 24.6897 56.3739, 24.6560 56.3729, 24.6470 56.3754, 24.6321 56.3733, 24.6361 56.3676, 24.6287 56.3614, 24.6329 56.3550, 24.6290 56.3458, 24.6172 56.3424, 24.6085 56.3332, 24.5917 56.3307, 24.5813 56.3212, 24.5881 56.3055, 24.5816 56.2859, 24.5655 56.2865, 24.5209 56.2787, 24.4858 56.2670, 24.4660 56.2641, 24.4639 56.2585, 24.4538 56.2555, 24.4206 56.2588, 24.3900 56.2758, 24.3811 56.2764, 24.3559 56.2699, 24.3378 56.2935, 24.3151 56.2985, 24.2912 56.2965, 24.2932 56.2835, 24.2720 56.2807, 24.2590 56.2743, 24.2410 56.2752, 24.2041 56.2649, 24.1790 56.2485, 24.1548 56.2510, 24.1216 56.2462, 24.1103 56.2497, 24.1133 56.2605, 24.0925 56.2693, 24.0923 56.2748, 24.0420 56.2781, 24.0442 56.2981, 24.0184 56.3094, 24.0146 56.3271, 23.9145 56.3284, 23.9091 56.3360, 23.8284 56.3354, 23.8050 56.3395, 23.7845 56.3184, 23.7641 56.3214, 23.7573 56.3369, 23.7756 56.3662, 23.7650 56.3700, 23.6321 56.3575, 23.6051 56.3467, 23.5855 56.3431, 23.5748 56.3361, 23.5447 56.3294, 23.5087 56.3333, 23.4800 56.3451, 23.4368 56.3494, 23.4156 56.3679, 23.3863 56.3763, 23.3133 56.3799, 23.2839 56.3693, 23.1775 56.3657, 23.1861 56.3588, 23.1778 56.3535, 23.1805 56.3465, 23.1888 56.3431, 23.1880 56.3358, 23.1484 56.3244, 23.1180 56.3118, 23.1177 56.3058, 23.0931 56.3019, 23.0809 56.3159, 23.0693 56.3213, 23.0439 56.3175, 23.0229 56.3297, 23.0003 56.3680, 23.0130 56.3725, 22.9985 56.4036, 22.9755 56.4033, 22.9663 56.4113, 22.9450 56.4120, 22.9406 56.4012, 22.9266 56.3968, 22.9334 56.3878, 22.9234 56.3777, 22.9018 56.3717, 22.8387 56.3622, 22.8332 56.3643, 22.7604 56.3646, 22.7469 56.3696, 22.7314 56.3694, 22.7148 56.3626, 22.7003 56.3510, 22.6800 56.3489, 22.6577 56.3598, 22.6363 56.3623, 22.6132 56.3798, 22.5872 56.3818, 22.5788 56.3877, 22.5573 56.3849, 22.5367 56.3864, 22.5277 56.3910, 22.5097 56.3902, 22.4745 56.4010, 22.4467 56.4002, 22.4287 56.4068, 22.4064 56.4048, 22.3915 56.3982, 22.3670 56.3992, 22.3483 56.3911, 22.3190 56.3999, 22.3122 56.4067, 22.2977 56.4043, 22.2866 56.4061, 22.2804 56.4011, 22.2396 56.3975, 22.2321 56.3996, 22.2296 56.4052, 22.2223 56.4047, 22.2114 56.4108, 22.2072 56.4214, 22.1650 56.4170, 22.1298 56.4290, 22.1019 56.4233, 22.0927 56.4250, 22.0872 56.4204, 22.0739 56.4214, 22.0494 56.4144, 22.0314 56.4217, 22.0210 56.4217, 22.0176 56.4124, 21.9989 56.4114, 21.9923 56.3990, 21.9821 56.3922, 21.9830 56.3847, 21.9760 56.3756, 21.9681 56.3741, 21.9558 56.3785, 21.9478 56.3727, 21.9238 56.3700, 21.9199 56.3656, 21.8733 56.3588, 21.8625 56.3640, 21.8373 56.3687, 21.8266 56.3610, 21.8130 56.3590, 21.7905 56.3415, 21.7510 56.3310, 21.7268 56.3112, 21.6726 56.3087, 21.6585 56.3153, 21.6166 56.3216, 21.6032 56.3211, 21.5902 56.3197, 21.5785 56.3121, 21.5671 56.3127, 21.5587 56.3010, 21.5365 56.2910, 21.5269 56.2910, 21.5149 56.2868, 21.5082 56.2897, 21.4966 56.2892, 21.4715 56.2694, 21.4698 56.2596, 21.4555 56.2466, 21.4334 56.2382, 21.4189 56.2392, 21.3812 56.2256, 21.3566 56.2224, 21.3397 56.2148, 21.3304 56.2151, 21.3025 56.1902, 21.2871 56.1833, 21.2827 56.1726, 21.2572 56.1630, 21.2350 56.1597, 21.2324 56.1478, 21.2437 56.1301, 21.2437 56.1224, 21.2394 56.1142, 21.2289 56.1110, 21.2296 56.1024, 21.2173 56.0945, 21.2057 56.0751, 21.1792 56.0724, 21.1606 56.0827, 21.1449 56.0775, 21.0650 56.0665, 21.0599 56.0690, 21.0272 56.1394, 20.9785 56.2171, 20.9754 56.2471, 20.9793 56.3032, 20.9668 56.3438)))',4326)),
       'VZD adrešu reģistra telpiskie dati (Novadi + Pilsetas), 300 m buffer')
on conflict(country_code) do update set geom=excluded.geom,source=excluded.source,updated_at=now();

create table if not exists meets_private.place_centroids(
  kods bigint primary key,
  kind text not null check (kind in ('city','village','parish')),
  name text not null,
  name_stem text not null,
  std text not null,
  municipality_id bigint references public.municipalities(id),
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);
create index if not exists place_centroids_lookup on meets_private.place_centroids(municipality_id,name_stem);
revoke all on meets_private.place_centroids from public,anon,authenticated;

create table if not exists meets_private.culture_institutions(
  isil text primary key,
  sector text not null,
  kind text,
  name text not null,
  address text not null,
  municipality_id bigint references public.municipalities(id),
  latitude double precision not null,
  longitude double precision not null,
  url text,
  -- How the coordinates were confirmed: 'register' (within 300 m of the register
  -- address), 'settlement' (near the centre of the town or village of the address).
  coord_check text check (coord_check in ('register','settlement')),
  updated_at timestamptz not null default now()
);
create index if not exists culture_institutions_municipality on meets_private.culture_institutions(municipality_id);
revoke all on meets_private.culture_institutions from public,anon,authenticated;

create table if not exists meets_private.place_reference_load(
  kind text primary key check (kind in ('centroids','institutions')),
  state text not null default 'idle' check (state in ('idle','running','done','failed')),
  rows_loaded integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
insert into meets_private.place_reference_load(kind) values('centroids'),('institutions') on conflict do nothing;
revoke all on meets_private.place_reference_load from public,anon,authenticated;

-- One automatically resolved place: every event with this name in this
-- municipality gets this point. active=false (after a revert) blocks the place
-- from being resolved automatically again.
create table if not exists meets_private.location_auto_places(
  id bigint generated always as identity primary key,
  place_key text not null,
  municipality_id bigint not null references public.municipalities(id),
  method text not null check (method in ('address_register','culture_institution','settlement_center','source_page_address')),
  source_ref text not null,
  label text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  basis text not null,
  sample_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  revert_note text,
  unique(place_key,municipality_id)
);
revoke all on meets_private.location_auto_places from public,anon,authenticated;

-- What each event location held before the automatic point, for undoing it.
create table if not exists meets_private.location_auto_log(
  id bigint generated always as identity primary key,
  event_id uuid not null,
  place_id bigint not null references meets_private.location_auto_places(id),
  method text not null,
  previous jsonb not null,
  applied_at timestamptz not null default now(),
  reverted_at timestamptz
);
create index if not exists location_auto_log_event on meets_private.location_auto_log(event_id,place_id);
revoke all on meets_private.location_auto_log from public,anon,authenticated;

-- Addresses read from the event's source page (step 4).
create table if not exists meets_private.location_source_addresses(
  event_id uuid primary key references public.events(id) on delete cascade,
  source_url text not null,
  domain text not null,
  addresses text[] not null default '{}',
  status text not null,
  fetched_at timestamptz not null default now()
);
create index if not exists location_source_addresses_domain on meets_private.location_source_addresses(domain);
revoke all on meets_private.location_source_addresses from public,anon,authenticated;

-- Step 4 is off until switched on: update meets_private.app_settings set value='on' where key='location_auto_source_pages'.
insert into meets_private.app_settings(key,value) values('location_auto_source_pages','off') on conflict(key) do nothing;

alter table public.event_locations
  add column if not exists location_auto_place_id bigint references meets_private.location_auto_places(id);
create index if not exists event_locations_auto_place on public.event_locations(location_auto_place_id)
  where location_auto_place_id is not null;

-- ---------------------------------------------------------------------------
-- Names
-- ---------------------------------------------------------------------------
-- Words without their Latvian case endings: "Talsi", "Talsu", "Talsos" -> "tals".
create or replace function meets_private.lv_stems(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(string_agg(
           case when length(w)>4 then regexp_replace(w,'(as|es|is|us|os|am|a|e|i|u|s)$','')
                when length(w)>3 then regexp_replace(w,'[aeius]$','')
                else w end,' ' order by ord),'')
    from regexp_split_to_table(meets_private.plain_text(p_text),' ') with ordinality t(w,ord)
   where w<>''
$$;

-- The same place under one key: "Rīgas Teikas vsk. 1.zāle" = "Rīgas Teikas vidusskola".
create or replace function meets_private.location_place_key(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select meets_private.plain_text(meets_private.place_search_query(meets_private.location_base_hall_name(p_name),null))
$$;

-- The municipality an official address lies in:
-- "…, Asūne, Asūnes pag., Krāslavas nov., LV-5677" -> Krāslavas novads; "…, Rīga, LV-1050" -> Rīgas valstspilsēta.
create or replace function meets_private.std_municipality_id(p_std text)
returns bigint
language sql
stable
set search_path to ''
as $$
  with parts as (
    select btrim(x) p,ord
      from unnest(string_to_array(regexp_replace(coalesce(p_std,''),',?\s*LV-\d{4}\s*$',''),',')) with ordinality t(x,ord)
     where btrim(x)<>''
  )
  select m.id from public.municipalities m
   where m.name=coalesce(
           (select regexp_replace(p,'\s+nov\.$',' novads') from parts where p ~ '\snov\.$' order by ord desc limit 1),
           (select case when p ~ 's$' then p else p||'s' end||' valstspilsēta' from parts order by ord desc limit 1))
$$;

-- Stems of the town or village and of the parish of an official address.
create or replace function meets_private.std_locality_stems(p_std text)
returns text[]
language sql
immutable
set search_path to ''
as $$
  with parts as (
    select btrim(x) p,ord
      from unnest(string_to_array(regexp_replace(coalesce(p_std,''),',?\s*LV-\d{4}\s*$',''),',')) with ordinality t(x,ord)
     where btrim(x)<>''
  )
  select coalesce(array_agg(s) filter (where s<>''),'{}') from (
    -- A town or village: not the street or house (first part), not a parish or municipality.
    select meets_private.lv_stems(p) s from parts
     where p !~ '\s(pag|nov)\.$' and (ord>1 or (select count(*) from parts)=1) and p !~ '[0-9"]'
    union
    select meets_private.lv_stems(regexp_replace(p,'\s+pag\.$','')) from parts where p ~ '\spag\.$'
  ) x
$$;

create or replace function meets_private.point_in_country(p_country text, p_latitude double precision, p_longitude double precision)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select extensions.st_covers(b.geom,extensions.st_setsrid(extensions.st_makepoint(p_longitude,p_latitude),4326))
      from meets_private.country_borders b where b.country_code=p_country),false)
$$;

create or replace function meets_private.points_distance_m(p_lat1 double precision, p_lon1 double precision, p_lat2 double precision, p_lon2 double precision)
returns double precision
language sql
immutable
set search_path to ''
as $$
  select extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(p_lon1,p_lat1),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_lon2,p_lat2),4326)::extensions.geography)
$$;

-- ---------------------------------------------------------------------------
-- Step 1: the address register, strictly
-- ---------------------------------------------------------------------------
-- status 'match': one register address in the municipality whose town, village or
--   parish the text names (in a city municipality the city itself is enough);
-- 'unconfirmed': the only such address in the municipality, but the text does not
--   name its town; 'ambiguous': several; 'none': no street address found.
create or replace function meets_private.location_auto_register_match(p_text text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_segment text;
  v_match text;
  v_words text[];
  v_city boolean;
  v_stems text := ' '||meets_private.lv_stems(p_text)||' ';
  v_found jsonb;
  v_hits jsonb := '[]'::jsonb;
  v_total integer;
  v_confirmed integer;
begin
  if p_municipality_id is null or btrim(coalesce(p_text,''))='' then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$' into v_city from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  foreach v_segment in array regexp_split_to_array(p_text,'[,;()]') loop
    v_match := substring(v_segment from '((?:\S+\s+){0,4}(?:iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|ceļš|ceļā|aleja|alejā|krastmala|krastmalā|līnija|līnijā|dambis|dambī)\s+\d+(?:\s?[A-Za-z](?![[:alnum:]]))?(?:\s?[/-]\s?\d+[A-Za-z]?(?![[:alnum:]]))?)');
    continue when v_match is null;
    -- "Bibliotēka Kalēju iela 9": the longest street name the register knows wins,
    -- so "Lielā Dārza iela 5" is never read as "Dārza iela 5".
    v_words := regexp_split_to_array(btrim(v_match),'\s+');
    for i in 1..greatest(1,cardinality(v_words)-2) loop
      select jsonb_agg(jsonb_build_object('kods',a.kods,'std',a.std,'latitude',a.latitude,'longitude',a.longitude,
               'confirmed',v_city or exists(
                  select 1 from unnest(meets_private.std_locality_stems(a.std)) s where position(' '||s||' ' in v_stems)>0)))
        into v_found
        from meets_private.address_register a
       where a.house_key=meets_private.address_key(array_to_string(v_words[i:],' '))
         and meets_private.std_municipality_id(a.std)=p_municipality_id;
      if v_found is not null then
        v_hits := v_hits||v_found;
        exit;
      end if;
    end loop;
  end loop;

  select count(distinct h->>'kods'),count(distinct h->>'kods') filter (where (h->>'confirmed')::boolean)
    into v_total,v_confirmed from jsonb_array_elements(v_hits) h;
  if v_total=0 then return jsonb_build_object('status','none'); end if;
  if v_confirmed=1 then
    return (select (h-'confirmed')||jsonb_build_object('status','match') from jsonb_array_elements(v_hits) h
             where (h->>'confirmed')::boolean limit 1);
  end if;
  if v_confirmed=0 and v_total=1 then
    return (v_hits->0)-'confirmed'||jsonb_build_object('status','unconfirmed');
  end if;
  return jsonb_build_object('status','ambiguous','count',v_total);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 2: known institutions
-- ---------------------------------------------------------------------------
-- A name without the words that only say whose institution it is.
create or replace function meets_private.location_name_core(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p_name,''),
    '(^|[\s,])(novada|novads|pagasta|pagasts|pilsētas|pilsēta|pašvaldības)(?=[\s,]|$)','\1','gi'),'\s+',' ','g'),' ,')
$$;

-- The whole name and each of its comma-separated parts that could name an institution
-- ("Skaistkalnes pagasts, Skaistkalnes tautas nams" -> also "Skaistkalnes tautas nams").
create or replace function meets_private.location_name_variants(p_name text)
returns text[]
language sql
immutable
set search_path to ''
as $$
  select coalesce(array_agg(distinct v),'{}') from (
    select meets_private.location_name_core(x) v
      from unnest(array[meets_private.location_base_hall_name(p_name)]
                  ||string_to_array(meets_private.location_base_hall_name(p_name),',')) x
  ) s
  where v !~ '[0-9]\s*[a-zA-Z]?$'
    and (select count(*) from regexp_split_to_table(meets_private.plain_text(meets_private.place_search_query(v,null)),' ') w where length(w)>3)>=2
$$;

-- status 'match': exactly one institution (one point) of the municipality has the
-- same name, word for word in both directions, and the text names its town or parish.
create or replace function meets_private.location_auto_institution_match(p_name text, p_text text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_variants text[] := meets_private.location_name_variants(p_name);
  v_city boolean;
  v_stems text := ' '||meets_private.lv_stems(concat_ws(' ',p_name,p_text))||' ';
  v_hits jsonb;
  v_total integer;
  v_confirmed integer;
begin
  if p_municipality_id is null or cardinality(v_variants)=0 then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$' into v_city from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  select jsonb_agg(jsonb_build_object('isil',i.isil,'name',i.name,'address',i.address,
           'latitude',i.latitude,'longitude',i.longitude,
           'point',round(i.latitude::numeric,4)||','||round(i.longitude::numeric,4),
           'confirmed',v_city or exists(
              select 1 from unnest(meets_private.std_locality_stems(i.address)) s where position(' '||s||' ' in v_stems)>0))
           order by i.isil)
    into v_hits
    from meets_private.culture_institutions i
   where i.municipality_id=p_municipality_id and i.coord_check is not null
     and exists (
       select 1 from unnest(v_variants) v
        where meets_private.place_names_match(v,meets_private.location_name_core(i.name))
          and meets_private.place_names_match(meets_private.location_name_core(i.name),v));
  if v_hits is null then return jsonb_build_object('status','none'); end if;

  select count(distinct h->>'point'),count(distinct h->>'point') filter (where (h->>'confirmed')::boolean)
    into v_total,v_confirmed from jsonb_array_elements(v_hits) h;
  if v_total>1 then return jsonb_build_object('status','ambiguous','count',v_total); end if;
  return ((v_hits->0)-'confirmed'-'point')
         ||jsonb_build_object('status',case when v_confirmed=1 then 'match' else 'unconfirmed' end);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 3: a bare town, village or parish name
-- ---------------------------------------------------------------------------
-- Every comma-separated part of the name must be a town, village or parish of the
-- municipality ("Priekules pilsēta, Priekule", "Iecavas pagasts", "Pope") and they
-- must agree on one place. The municipality's own name alone is not a place.
create or replace function meets_private.location_auto_settlement_match(p_name text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_part text;
  v_plain text;
  v_kind text;
  v_stem text;
  v_municipality text;
  v_ids bigint[];
  v_specific bigint[];   -- towns and villages named
  v_parishes bigint[] := '{}';
  v_first boolean := true;
  v_kods bigint;
begin
  if p_municipality_id is null or btrim(coalesce(p_name,''))='' or p_name ~ '[0-9]' then
    return jsonb_build_object('status','none');
  end if;
  select meets_private.lv_stems(regexp_replace(m.name,' (novads|valstspilsēta)$','')) into v_municipality
    from public.municipalities m where m.id=p_municipality_id and m.name ~ ' (novads|valstspilsēta)$';
  if v_municipality is null then return jsonb_build_object('status','none'); end if;

  foreach v_part in array string_to_array(p_name,',') loop
    v_plain := meets_private.plain_text(v_part);
    continue when v_plain='';
    v_kind := case when v_plain ~ ' (pagasts|pagasta|pagasta|pag)$' then 'parish'
                   when v_plain ~ ' (pilseta|pilsetas)$' then 'city'
                   when v_plain ~ ' (ciems|ciema)$' then 'village'
                   when v_plain ~ ' (novads|novada|valstspilseta)$' then 'municipality' end;
    v_stem := meets_private.lv_stems(regexp_replace(v_plain,' (pagasts|pagasta|pag|pilseta|pilsetas|ciems|ciema|novads|novada|valstspilseta)$',''));
    if v_kind='municipality' then
      -- "…, Bauskas novads" only repeats the municipality.
      if v_stem=v_municipality then continue; end if;
      return jsonb_build_object('status','none');
    end if;
    select array_agg(c.kods) into v_ids
      from meets_private.place_centroids c
     where c.municipality_id=p_municipality_id and c.name_stem=v_stem
       and case when v_kind is null then c.kind in ('city','village') else c.kind=v_kind end;
    if v_ids is null then return jsonb_build_object('status','none'); end if;
    if v_kind='parish' then
      v_parishes := v_parishes||v_ids;
    elsif v_first then
      v_specific := v_ids; v_first := false;
    else
      v_specific := array(select unnest(v_specific) intersect select unnest(v_ids));
    end if;
  end loop;

  if v_specific is null then
    if cardinality(v_parishes)<>1 then
      return jsonb_build_object('status',case when cardinality(v_parishes)=0 then 'none' else 'ambiguous' end);
    end if;
    v_kods := v_parishes[1];
  else
    -- Two villages of one name in the municipality: the parish named with them decides.
    if cardinality(v_specific)>1 and cardinality(v_parishes)>0 then
      v_specific := array(
        select c.kods from meets_private.place_centroids c
         where c.kods=any(v_specific)
           and exists (select 1 from meets_private.place_centroids p
                        where p.kods=any(v_parishes) and position(p.name in c.std)>0));
    end if;
    if cardinality(v_specific)<>1 then
      return jsonb_build_object('status',case when cardinality(v_specific)=0 then 'none' else 'ambiguous' end);
    end if;
    v_kods := v_specific[1];
  end if;
  return (select jsonb_build_object('status','match','kods',c.kods,'kind',c.kind,'name',c.name,'std',c.std,
                   'latitude',c.latitude,'longitude',c.longitude)
            from meets_private.place_centroids c where c.kods=v_kods);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 4: an address from the source page
-- ---------------------------------------------------------------------------
-- The addresses found on the event's page, without the ones the site prints on
-- its pages for three or more different places (the municipality's own address).
create or replace function meets_private.location_source_page_addresses(p_event_id uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(a),'{}')
    from meets_private.location_source_addresses s
    cross join unnest(s.addresses) a
   where s.event_id=p_event_id
     and (select count(*) from meets_private.location_source_addresses d where d.domain=s.domain and d.status='ok')>=3
     and (select count(distinct meets_private.location_place_key(coalesce(nullif(btrim(l.venue_name),''),l.address_raw))
                              ||'|'||coalesce(l.municipality_id,0))
            from meets_private.location_source_addresses o
            join public.event_locations l on l.event_id=o.event_id
           where o.domain=s.domain
             and exists (select 1 from unnest(o.addresses) b
                          where meets_private.address_key(split_part(b,',',1))=meets_private.address_key(split_part(a,',',1))))<3
$$;

-- ---------------------------------------------------------------------------
-- The plan: one row per place (name + municipality) without a verified point
-- ---------------------------------------------------------------------------
do $$ begin
  create type meets_private.location_auto_plan_row as (
    place_key text, municipality_id bigint, municipality text, sample_name text, sample_address text,
    events integer, published integer, upcoming integer,
    decision text, method text, source_ref text, matched_label text, matched_address text,
    latitude double precision, longitude double precision, reason text, event_ids uuid[]);
exception when duplicate_object then null; end $$;

-- decision 'apply' (a new automatic place), 'existing' (an automatic place already
-- saved) or 'manual' (stays with the admin; reason says why). Reads only.
create or replace function meets_private.location_auto_plan(p_steps text[] default null)
returns setof meets_private.location_auto_plan_row
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_steps text[] := coalesce(p_steps,array['address_register','culture_institution','settlement_center']
    ||case when (select value from meets_private.app_settings where key='location_auto_source_pages')='on'
           then array['source_page_address'] else '{}'::text[] end);
  v_today date := (now() at time zone 'Europe/Riga')::date;
  g record;
  r meets_private.location_auto_plan_row;
  v_place meets_private.location_auto_places%rowtype;
  v_text text;
  v_alias text;
  v_event uuid;
  j jsonb;
  v_reg jsonb; v_reg_kods text[]; v_reg_ambiguous boolean; v_reg_unconfirmed jsonb; v_addressless integer;
  v_inst jsonb; v_inst_points text[]; v_inst_bad text;
  v_set jsonb; v_set_kods text[]; v_set_bad boolean;
  v_page jsonb; v_page_kods text[]; v_page_bad boolean;
  v_specific boolean;
  v_why text;
begin
  for g in
    select k.place_key,l.municipality_id,m.name municipality,
           count(*)::integer events,
           (count(*) filter (where e.status='published'))::integer published,
           (count(*) filter (where coalesce(e.date_to,e.date_from)>=v_today))::integer upcoming,
           array_agg(l.event_id order by l.event_id) event_ids,
           (array_agg(k.alias order by e.date_from desc,l.event_id))[1] sample_name,
           max(nullif(btrim(l.address_raw),'')) sample_address,
           array_agg(distinct k.alias) aliases,
           array_agg(distinct concat_ws(', ',k.alias,nullif(btrim(l.address_raw),k.alias),nullif(btrim(l.locality_text),''))) texts
      from public.event_locations l
      join public.events e on e.id=l.event_id
      left join public.municipalities m on m.id=l.municipality_id
      cross join lateral (select coalesce(nullif(btrim(l.venue_name),''),nullif(btrim(l.address_raw),''),'') alias) a
      cross join lateral (select a.alias,meets_private.location_place_key(a.alias) place_key) k
     where l.verified_at is null
       and l.location_auto_place_id is null
       and l.venue_point is null
       and e.status in ('pending_review','published')
       and coalesce(e.attendance_mode,'')<>'online'
       and coalesce(l.country_code,'LV')='LV'
     group by k.place_key,l.municipality_id,m.name
     order by count(*) desc,k.place_key
  loop
    r := null;
    r.place_key := g.place_key; r.municipality_id := g.municipality_id; r.municipality := g.municipality;
    r.sample_name := g.sample_name; r.sample_address := g.sample_address;
    r.events := g.events; r.published := g.published; r.upcoming := g.upcoming; r.event_ids := g.event_ids;
    r.decision := 'manual';

    if length(g.place_key)<3 then
      r.reason := 'Nav norises vietas nosaukuma';
      return next r; continue;
    elsif g.municipality_id is null then
      r.reason := 'Nav noteikts novads';
      return next r; continue;
    elsif g.municipality !~ ' (novads|valstspilsēta)$' then
      r.reason := 'Vieta nav vienā Latvijas pašvaldībā';
      return next r; continue;
    end if;

    select * into v_place from meets_private.location_auto_places p
     where p.place_key=g.place_key and p.municipality_id=g.municipality_id;
    if found then
      if v_place.active then
        r.decision := 'existing'; r.method := v_place.method; r.source_ref := v_place.source_ref;
        r.matched_label := v_place.label; r.matched_address := v_place.address;
        r.latitude := v_place.latitude; r.longitude := v_place.longitude;
        r.reason := 'Vietai jau ir automātisks punkts';
      else
        r.reason := 'Automātiskais punkts šai vietai ir atsaukts';
      end if;
      return next r; continue;
    end if;

    v_specific := (select count(*) from regexp_split_to_table(g.place_key,' ') w where length(w)>3)>=2;
    v_why := null;

    -- Step 1.
    v_reg := null; v_reg_kods := '{}'; v_reg_ambiguous := false; v_reg_unconfirmed := null; v_addressless := 0;
    foreach v_text in array g.texts loop
      j := meets_private.location_auto_register_match(v_text,g.municipality_id);
      case j->>'status'
        when 'match' then
          v_reg := j;
          if not (j->>'kods')=any(v_reg_kods) then v_reg_kods := v_reg_kods||(j->>'kods'); end if;
        when 'ambiguous' then v_reg_ambiguous := true;
        when 'unconfirmed' then v_reg_unconfirmed := j;
        else v_addressless := v_addressless+1;
      end case;
    end loop;
    if v_reg_ambiguous then
      v_reg := null; v_why := 'Adrešu reģistrā šai adresei novadā ir vairākas iespējamās vietas';
    elsif cardinality(v_reg_kods)>1 then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vienam vietas nosaukumam pasākumos ir dažādas adreses';
    elsif v_reg is not null and v_reg_unconfirmed is not null and v_reg_unconfirmed->>'kods'<>v_reg->>'kods' then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vienam vietas nosaukumam pasākumos ir dažādas adreses';
    elsif v_reg is not null and v_addressless>0 and not v_specific then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vispārīgs nosaukums, un daļai pasākumu adreses nav';
    elsif v_reg is null and v_reg_unconfirmed is not null then
      v_why := 'Adrese ir vienīgā novadā, bet tekstā nav nosaukta apdzīvotā vieta';
    end if;
    if not 'address_register'=any(v_steps) then v_reg := null; end if;

    -- Step 2.
    v_inst := null; v_inst_points := '{}'; v_inst_bad := null;
    if 'culture_institution'=any(v_steps) then
      foreach v_alias in array g.aliases loop
        j := meets_private.location_auto_institution_match(v_alias,array_to_string(g.texts,', '),g.municipality_id);
        case j->>'status'
          when 'match' then
            v_inst := j;
            if not (j->>'isil')=any(v_inst_points) then v_inst_points := v_inst_points||(j->>'isil'); end if;
          when 'ambiguous' then v_inst_bad := 'Iestāžu tabulā nosaukumam atbilst vairākas iestādes';
          when 'unconfirmed' then v_inst_bad := 'Iestāde atrasta pēc nosaukuma, bet tekstā nav nosaukta tās apdzīvotā vieta';
          else null;
        end case;
      end loop;
      if v_inst_bad is not null or cardinality(v_inst_points)>1 then
        v_inst := null; v_why := coalesce(v_why,v_inst_bad,'Iestāžu tabulā nosaukumam atbilst vairākas iestādes');
      end if;
    end if;

    -- Step 3.
    v_set := null; v_set_kods := '{}'; v_set_bad := false;
    if 'settlement_center'=any(v_steps) then
      foreach v_alias in array g.aliases loop
        j := meets_private.location_auto_settlement_match(v_alias,g.municipality_id);
        if j->>'status'='match' then
          v_set := j;
          if not (j->>'kods')=any(v_set_kods) then v_set_kods := v_set_kods||(j->>'kods'); end if;
        else
          v_set_bad := true;
          if j->>'status'='ambiguous' then v_why := coalesce(v_why,'Novadā ir vairākas apdzīvotas vietas ar šādu nosaukumu'); end if;
        end if;
      end loop;
      if v_set_bad or cardinality(v_set_kods)<>1 then v_set := null; end if;
    end if;

    -- Decide.
    if v_reg is not null and v_inst is not null
       and meets_private.points_distance_m((v_reg->>'latitude')::float8,(v_reg->>'longitude')::float8,
                                           (v_inst->>'latitude')::float8,(v_inst->>'longitude')::float8)>300 then
      r.reason := 'Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m';
    elsif v_reg is not null then
      r.decision := 'apply'; r.method := 'address_register'; r.source_ref := 'var:'||(v_reg->>'kods');
      r.matched_label := split_part(v_reg->>'std',', ',1); r.matched_address := v_reg->>'std';
      r.latitude := (v_reg->>'latitude')::float8; r.longitude := (v_reg->>'longitude')::float8;
    elsif v_inst is not null and v_reg_ambiguous then
      r.reason := v_why;
    elsif v_inst is not null and v_reg_unconfirmed is not null
       and meets_private.points_distance_m((v_reg_unconfirmed->>'latitude')::float8,(v_reg_unconfirmed->>'longitude')::float8,
                                           (v_inst->>'latitude')::float8,(v_inst->>'longitude')::float8)>300 then
      r.reason := 'Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m';
    elsif v_inst is not null then
      r.decision := 'apply'; r.method := 'culture_institution'; r.source_ref := 'kulturasdati:'||(v_inst->>'isil');
      r.matched_label := v_inst->>'name'; r.matched_address := v_inst->>'address';
      r.latitude := (v_inst->>'latitude')::float8; r.longitude := (v_inst->>'longitude')::float8;
    elsif v_set is not null then
      r.decision := 'apply'; r.method := 'settlement_center'; r.source_ref := 'vzd-centroid:'||(v_set->>'kods');
      r.matched_label := v_set->>'name'; r.matched_address := v_set->>'std';
      r.latitude := (v_set->>'latitude')::float8; r.longitude := (v_set->>'longitude')::float8;
    elsif 'source_page_address'=any(v_steps) and v_why is null then
      -- Step 4: only where nothing else was found.
      v_page := null; v_page_kods := '{}'; v_page_bad := false;
      foreach v_event in array g.event_ids loop
        foreach v_text in array meets_private.location_source_page_addresses(v_event) loop
          j := meets_private.location_auto_register_match(v_text||', '||g.sample_name,g.municipality_id);
          if j->>'status'='match' then
            v_page := j;
            if not (j->>'kods')=any(v_page_kods) then v_page_kods := v_page_kods||(j->>'kods'); end if;
          elsif j->>'status' in ('ambiguous','unconfirmed') then
            v_page_bad := true;
          end if;
        end loop;
      end loop;
      if v_page is not null and not v_page_bad and cardinality(v_page_kods)=1 then
        r.decision := 'apply'; r.method := 'source_page_address'; r.source_ref := 'var:'||(v_page->>'kods');
        r.matched_label := split_part(v_page->>'std',', ',1); r.matched_address := v_page->>'std';
        r.latitude := (v_page->>'latitude')::float8; r.longitude := (v_page->>'longitude')::float8;
      elsif v_page is not null or v_page_bad then
        r.reason := 'Avota lapā atrastas vairākas vai neskaidras adreses';
      end if;
    end if;

    if r.decision='apply' then
      if not meets_private.point_in_country('LV',r.latitude,r.longitude) then
        r.decision := 'manual'; r.reason := 'Atrastais punkts ir ārpus Latvijas robežas';
      elsif exists (
        select 1 from public.event_locations l2
         where l2.municipality_id=g.municipality_id and l2.verified_at is not null and l2.map_point is not null
           and meets_private.location_place_key(coalesce(nullif(btrim(l2.venue_name),''),l2.address_raw))=g.place_key
           and extensions.st_distance(l2.map_point,
                 extensions.st_setsrid(extensions.st_makepoint(r.longitude,r.latitude),4326)::extensions.geography)>150) then
        r.decision := 'manual'; r.reason := 'Tai pašai vietai citā pasākumā ir pārbaudīts punkts citur';
      end if;
      if r.decision='manual' then
        r.method := null; r.source_ref := null;
      end if;
    end if;
    if r.decision='manual' and r.reason is null then
      r.reason := coalesce(v_why,case
        when g.sample_name ~ '[0-9]' then 'Adrese nav atrasta adrešu reģistrā šajā novadā'
        else 'Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā' end);
    end if;
    return next r;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Loading the reference tables (edge function load-place-reference, service role)
-- ---------------------------------------------------------------------------
create or replace function public.meets_place_reference_import(p_kind text, p_rows jsonb, p_first boolean default false, p_last boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer := 0; v_started timestamptz;
begin
  if p_kind not in ('centroids','institutions') then raise exception 'Unknown kind %',p_kind; end if;
  if p_first then
    update meets_private.place_reference_load
       set state='running',rows_loaded=0,started_at=now(),finished_at=null,error=null where kind=p_kind;
  end if;

  if p_kind='centroids' then
    -- [kods, type code, name, std, latitude, longitude]; 104 town, 105 parish, 106 village.
    insert into meets_private.place_centroids(kods,kind,name,name_stem,std,municipality_id,latitude,longitude)
    select (r->>0)::bigint,
           case r->>1 when '104' then 'city' when '105' then 'parish' else 'village' end,
           r->>2,
           meets_private.lv_stems(regexp_replace(r->>2,'\s+pag\.$','')),
           r->>3,meets_private.std_municipality_id(r->>3),(r->>4)::float8,(r->>5)::float8
      from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
     where r->>1 in ('104','105','106')
    on conflict(kods) do update
       set kind=excluded.kind,name=excluded.name,name_stem=excluded.name_stem,std=excluded.std,
           municipality_id=excluded.municipality_id,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();
  else
    -- [isil, sector, kind, name, address, latitude, longitude, url]
    insert into meets_private.culture_institutions(isil,sector,kind,name,address,municipality_id,latitude,longitude,url)
    select r->>0,r->>1,nullif(r->>2,''),btrim(r->>3),r->>4,meets_private.std_municipality_id(r->>4),
           (r->>5)::float8,(r->>6)::float8,nullif(r->>7,'')
      from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
    on conflict(isil) do update
       set sector=excluded.sector,kind=excluded.kind,name=excluded.name,address=excluded.address,
           municipality_id=excluded.municipality_id,latitude=excluded.latitude,longitude=excluded.longitude,
           url=excluded.url,coord_check=null,updated_at=now();
  end if;
  get diagnostics v_count=row_count;
  update meets_private.place_reference_load set rows_loaded=rows_loaded+v_count where kind=p_kind
  returning started_at into v_started;

  if p_last then
    -- Rows the new file no longer has are dropped, unless the file came back almost empty.
    if p_kind='centroids' then
      if (select count(*) from meets_private.place_centroids where updated_at>=v_started)>=3000 then
        delete from meets_private.place_centroids where updated_at<v_started;
      end if;
    else
      if (select count(*) from meets_private.culture_institutions where updated_at>=v_started)>=1000 then
        delete from meets_private.culture_institutions i where i.updated_at<v_started
           and not exists (select 1 from meets_private.location_auto_places p where p.source_ref='kulturasdati:'||i.isil);
      end if;
      perform meets_private.culture_institutions_check();
    end if;
    update meets_private.place_reference_load set state='done',finished_at=now() where kind=p_kind;
  end if;
  return jsonb_build_object('loaded',v_count);
end
$$;

create or replace function public.meets_place_reference_failed(p_kind text, p_error text)
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.place_reference_load set state='failed',error=left(p_error,500) where kind=p_kind;
$$;

-- An institution's coordinates are trusted only when they agree with an official source:
-- within 300 m of its register address, or (no street address) within reach of the
-- centre of the town or village of its address. All must lie inside Latvia.
create or replace function meets_private.culture_institutions_check()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  update meets_private.culture_institutions i
     set coord_check=c.result
    from (
      select i2.isil,
             case
               when i2.municipality_id is null or not meets_private.point_in_country('LV',i2.latitude,i2.longitude) then null
               when reg.j->>'status'='match' then
                 case when meets_private.points_distance_m(i2.latitude,i2.longitude,(reg.j->>'latitude')::float8,(reg.j->>'longitude')::float8)<=300
                      then 'register' end
               when reg.j->>'status'='none' and exists (
                 select 1 from meets_private.place_centroids pc
                  where pc.municipality_id=i2.municipality_id and pc.kind in ('city','village')
                    and pc.name_stem=any(meets_private.std_locality_stems(i2.address))
                    and meets_private.points_distance_m(i2.latitude,i2.longitude,pc.latitude,pc.longitude)
                        <=case when pc.kind='city' then 12000 else 4000 end) then 'settlement'
             end result
        from meets_private.culture_institutions i2
        cross join lateral (select meets_private.location_auto_register_match(i2.address,i2.municipality_id) j) reg
    ) c
   where c.isil=i.isil and i.coord_check is distinct from c.result;
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Step 4 interface (edge function extract-source-addresses, service role)
-- ---------------------------------------------------------------------------
-- The next source pages to read: places the first three steps could not resolve.
create or replace function public.meets_location_source_pages_next(p_limit integer default 10, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not p_force and coalesce((select value from meets_private.app_settings where key='location_auto_source_pages'),'off')<>'on' then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('event_id',x.event_id,'url',x.source_url)),'[]'::jsonb) from (
      select distinct on (e.event_id) e.event_id,es.source_url
        from meets_private.location_auto_plan(array['address_register','culture_institution','settlement_center']) p
        cross join unnest(p.event_ids) e(event_id)
        join public.event_sources es on es.event_id=e.event_id and es.source_url ~ '^https?://'
       where p.decision='manual' and p.municipality_id is not null
         and p.reason in ('Adrese nav atrasta adrešu reģistrā šajā novadā','Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā')
         and not exists (select 1 from meets_private.location_source_addresses s
                          where s.event_id=e.event_id and s.fetched_at>now()-interval '30 days')
       order by e.event_id,es.id
       limit greatest(1,least(coalesce(p_limit,10),50))
    ) x);
end
$$;

create or replace function public.meets_location_source_pages_store(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  insert into meets_private.location_source_addresses(event_id,source_url,domain,addresses,status,fetched_at)
  select (r->>'event_id')::uuid,r->>'url',coalesce(substring(r->>'url' from '^https?://([^/]+)'),''),
         coalesce(array(select jsonb_array_elements_text(r->'addresses')),'{}'),coalesce(r->>'status','ok'),now()
    from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
   where exists (select 1 from public.events e where e.id=(r->>'event_id')::uuid)
  on conflict(event_id) do update
     set source_url=excluded.source_url,domain=excluded.domain,addresses=excluded.addresses,
         status=excluded.status,fetched_at=now();
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Rights: nothing here is callable by visitors or signed-in users.
-- ---------------------------------------------------------------------------
revoke execute on function meets_private.lv_stems(text) from public,anon,authenticated;
revoke execute on function meets_private.location_place_key(text) from public,anon,authenticated;
revoke execute on function meets_private.std_municipality_id(text) from public,anon,authenticated;
revoke execute on function meets_private.std_locality_stems(text) from public,anon,authenticated;
revoke execute on function meets_private.point_in_country(text,double precision,double precision) from public,anon,authenticated;
revoke execute on function meets_private.points_distance_m(double precision,double precision,double precision,double precision) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_register_match(text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_name_core(text) from public,anon,authenticated;
revoke execute on function meets_private.location_name_variants(text) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_institution_match(text,text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_settlement_match(text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_source_page_addresses(uuid) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_plan(text[]) from public,anon,authenticated;
revoke execute on function meets_private.culture_institutions_check() from public,anon,authenticated;
revoke execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.meets_place_reference_failed(text,text) from public,anon,authenticated;
revoke execute on function public.meets_location_source_pages_next(integer,boolean) from public,anon,authenticated;
revoke execute on function public.meets_location_source_pages_store(jsonb) from public,anon,authenticated;
grant execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) to service_role;
grant execute on function public.meets_place_reference_failed(text,text) to service_role;
grant execute on function public.meets_location_source_pages_next(integer,boolean) to service_role;
grant execute on function public.meets_location_source_pages_store(jsonb) to service_role;
