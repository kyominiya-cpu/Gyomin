#!/usr/bin/perl
# watch HTML에서 영상 설명(shortDescription)을 추출해 JSON 이스케이프를 풀어 출력.
use strict;
use warnings;

my $file = $ARGV[0] or die "usage: extract_description.pl <watch.html>\n";
open(my $fh, '<', $file) or die "cannot open $file: $!\n";
local $/;
my $h = <$fh>;
close($fh);

if ($h =~ /"shortDescription":"(.*?)","isCrawlable"/s) {
    my $d = $1;
    $d =~ s/\\n/\n/g;       # 줄바꿈
    $d =~ s/[\\]u0026/&/g;  # &
    $d =~ s/\\"/"/g;        # 따옴표
    $d =~ s{\\/}{/}g;       # 슬래시
    $d =~ s/\\\\/\\/g;      # 백슬래시
    print $d;
} else {
    print "";
}
