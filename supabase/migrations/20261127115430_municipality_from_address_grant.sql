-- event_locations trigger assign_municipality_from_place_name calls
-- meets_private.municipality_id_from_address(text) when the address carries "Latvija" or a
-- postcode. The function could be run only by postgres, so imports (service_role) failed
-- with "permission denied" on such addresses (handball.lv youth calendar).
grant execute on function meets_private.municipality_id_from_address(text) to service_role;
