<?php
// Usage: php run.php file.txt  -> JSON of parser state
$_GET['markup'] = file_get_contents($argv[1]);
$_GET['sharing']="2";
include 'ref_functions.php';
enumerate_tree('0');
echo json_encode([
 'wellformed'=>$wellformed,'errormsg'=>$errormsg,'code'=>$code,
 'questions'=>$questions,'answers'=>$answers,'qvarname'=>$qvarname,
 'title'=>$title,'author'=>$author,'description'=>$description,'before'=>$before,'after'=>$after,
], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
