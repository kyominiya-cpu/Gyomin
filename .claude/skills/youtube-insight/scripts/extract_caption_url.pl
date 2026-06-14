#!/usr/bin/perl
# 유튜브 watch HTML 파일에서 자막(timedtext) baseUrl을 추출하고
# & 이스케이프를 &로 복원해 stdout에 출력한다.
# 셸 이스케이프를 거치지 않도록 정규식을 파일에 둔다.
use strict;
use warnings;

my $file = $ARGV[0] or die "usage: extract_caption_url.pl <watch.html> [lang]\n";
my $want = $ARGV[1] // '';   # 선호 언어코드 (ko 등), 없으면 첫 트랙

open(my $fh, '<', $file) or die "cannot open $file: $!\n";
local $/;
my $html = <$fh>;
close($fh);

# captionTracks 배열에서 baseUrl과 languageCode 쌍을 모두 수집
my @tracks;
while ($html =~ /\{"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]*)"(.*?)\}/g) {
    my ($url, $rest) = ($1, $2);
    my $lang = ($rest =~ /"languageCode":"([^"]+)"/) ? $1 : '';
    # & -> &  ([\\] 로 리터럴 백슬래시를 모호함 없이 매칭)
    $url =~ s/[\\]u0026/&/g;
    push @tracks, { url => $url, lang => $lang };
}

die "no caption tracks found\n" unless @tracks;

# 선호 언어 우선
if ($want) {
    for my $t (@tracks) {
        if ($t->{lang} eq $want) { print $t->{url}; exit; }
    }
}
# 없으면 첫 트랙
print $tracks[0]{url};
