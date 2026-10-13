import urllib.request

# Splitting the URL into tiny chunks to completely bypass paste bugs
part1 = "https://githubusercontent.com"
part2 = "google/fonts/main/ofl/"
part3 = "creepster/Creepster-Regular.ttf"
url = part1 + part2 + part3

print("Downloading font...")
urllib.request.urlretrieve(url, "Creepster-Regular.ttf")
print("FONT DOWNLOADED PERFECTLY!")
