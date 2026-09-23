QnAs used by test/runtime.js and test/e2e.js only (goto_*: the goto() examples; load_*: a host QnA and the
QnAs it loads with loadQnA()). They use syntax the original PHP parser never had (X[javascript:…]), so they
are kept out of test/fixtures, which test/compare.js runs through that parser.
